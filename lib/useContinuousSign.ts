"use client";

// Nhận diện LIÊN TỤC cho chế độ "Dịch ký hiệu": camera chạy suốt, tự tách từng lần ký.
// Một lần ký kết thúc khi: hạ tay khỏi khung, hoặc tay đứng yên ~0,6s, hoặc quá 3,5s.
import { useEffect, useRef, useState } from "react";
import { getHandLandmarker, detectHands } from "./handLandmarker";
import { loadModel, predictTopK, type Prediction } from "./classifier";
import { buildFrameFeatures, resampleSequence, type HandResult } from "./landmarks";
import { drawHands } from "./draw";
import { computeHint, type Hint } from "./useSignPractice";

export type Status = "loading" | "idle" | "watching" | "thinking";

const MIN_FRAMES = 8;
const STILL_EPS = 0.006; // tổng dịch chuyển cổ tay/frame (toạ độ chuẩn hoá 0..1) coi là đứng yên
const STILL_END = 18; // ~0,6s đứng yên thì chốt
const GONE_MS = 400; // hạ tay quá 0,4s thì chốt
const MAX_MS = 3500;

function wrists(hands: HandResult[]) {
  const m: Record<string, { x: number; y: number }> = {};
  for (const h of hands) m[h.label] = { x: h.points[0].x, y: h.points[0].y };
  return m;
}

export function useContinuousSign(modelUrl: string, labelsUrl: string, onResult: (top: Prediction[]) => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cb = useRef(onResult);
  cb.current = onResult;
  const modelRef = useRef(modelUrl);

  const [status, setStatus] = useState<Status>("loading");
  const [handsVisible, setHandsVisible] = useState(0);
  const [hint, setHint] = useState<Hint>("none");
  const [modelReady, setModelReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  // Đổi model (từ ↔ câu) mà không mở lại camera
  useEffect(() => {
    modelRef.current = modelUrl;
    setModelReady(false);
    loadModel(modelUrl, labelsUrl)
      .then(() => modelRef.current === modelUrl && setModelReady(true))
      .catch(() => setModelReady(false));
  }, [modelUrl, labelsUrl]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    let raf = 0;
    let seg: { f: Float32Array; moving: boolean }[] = [];
    let segStart = 0;
    let lastHand = 0;
    let still = 0;
    let prevW: Record<string, { x: number; y: number }> = {};
    let busy = false;
    let lastHint: Hint = "none";
    let lastCount = -1;
    let lastStatus: Status = "loading"; // phải khớp giá trị khởi tạo của state, nếu không setS("idle") đầu tiên bị bỏ qua
    const setS = (s: Status) => {
      if (s !== lastStatus) {
        lastStatus = s;
        setStatus(s);
      }
    };

    const finish = async () => {
      const frames = seg;
      seg = [];
      still = 0;
      // bỏ đoạn đứng yên ở đầu/cuối (giữ 2 frame đệm) — model được train trên clip đã cắt sát
      let a = frames.findIndex((x) => x.moving);
      let b = frames.length - 1 - [...frames].reverse().findIndex((x) => x.moving);
      if (a < 0) return setS("idle");
      a = Math.max(0, a - 2);
      b = Math.min(frames.length - 1, b + 2);
      const core = frames.slice(a, b + 1).map((x) => x.f);
      if (core.length < MIN_FRAMES) return setS("idle");
      busy = true;
      setS("thinking");
      try {
        const top = await predictTopK(modelRef.current, resampleSequence(core), 3);
        cb.current(top);
      } catch {
        /* model chưa sẵn sàng */
      }
      busy = false;
      setS("idle");
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 }, audio: false });
        if (cancelled) return;
        const hl = await getHandLandmarker();
        if (cancelled) return;
        const loop = () => {
          const v = videoRef.current;
          if (v && stream && v.srcObject !== stream) {
            v.srcObject = stream;
            v.play().catch(() => {});
          }
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d") ?? null;
          if (v && v.readyState >= 2) {
            if (canvas && v.videoWidth && canvas.width !== v.videoWidth) {
              canvas.width = v.videoWidth;
              canvas.height = v.videoHeight;
            }
            const now = performance.now();
            const hands = detectHands(hl, v, now);
            if (ctx && canvas) drawHands(ctx, hands, canvas.width, canvas.height);
            if (hands.length !== lastCount) {
              lastCount = hands.length;
              setHandsVisible(hands.length);
            }
            const h = computeHint(hands);
            if (h !== lastHint) {
              lastHint = h;
              setHint(h);
            }

            if (!pausedRef.current && !busy) {
              if (hands.length) {
                const w = wrists(hands);
                let d = 0;
                for (const k of Object.keys(w)) if (prevW[k]) d += Math.abs(w[k].x - prevW[k].x) + Math.abs(w[k].y - prevW[k].y);
                const moving = Object.keys(prevW).length === 0 ? false : d > STILL_EPS;
                prevW = w;
                if (!seg.length) segStart = now;
                seg.push({ f: buildFrameFeatures(hands), moving });
                still = moving ? 0 : still + 1;
                lastHand = now;
                if (seg.some((x) => x.moving)) setS("watching");
                const movingCount = seg.filter((x) => x.moving).length;
                if ((still >= STILL_END && movingCount >= MIN_FRAMES) || now - segStart > MAX_MS) void finish();
                else if (still >= STILL_END && movingCount < MIN_FRAMES) {
                  seg = seg.slice(-4); // đứng yên lâu mà chưa ký gì → bỏ, chờ động tác mới
                }
              } else if (seg.length && now - lastHand > GONE_MS) {
                prevW = {};
                void finish();
              } else if (!seg.length) {
                prevW = {};
              }
            }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        setS("idle");
      } catch (e: unknown) {
        setCameraError(e instanceof Error ? e.message : "Không truy cập được camera.");
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { videoRef, canvasRef, status, handsVisible, hint, modelReady, cameraError, paused, setPaused };
}
