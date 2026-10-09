"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getHandLandmarker, detectHands } from "./handLandmarker";
import { loadModel, predictTopK, type Prediction } from "./classifier";
import { MODEL_URL, LABELS_URL } from "./constants";
import { buildFrameFeatures, resampleSequence, type HandResult } from "./landmarks";
import { drawHands } from "./draw";

export type Phase = "loading" | "ready" | "countdown" | "recording" | "result";

const RECORD_MS = 2500; // thời gian quay mỗi lần ký hiệu
const MIN_FRAMES = 6; // ít hơn số frame có tay này thì coi như "không thấy tay"

/** Gợi ý tư thế hiển thị trực tiếp trên khung camera */
export type Hint = "none" | "edge" | "close" | "far" | "ok";

export function computeHint(hands: HandResult[]): Hint {
  if (!hands.length) return "none";
  let size = 0;
  let edge = false;
  for (const h of hands) {
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const p of h.points) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    if (minX < 0.03 || maxX > 0.97 || minY < 0.03 || maxY > 0.97) edge = true;
    size = Math.max(size, maxY - minY, maxX - minX);
  }
  if (edge) return "edge";
  if (size > 0.6) return "close";
  if (size < 0.12) return "far";
  return "ok";
}

/** modelUrl/labelsUrl mặc định = model 100 từ đơn; truyền model khác cho "Câu giao tiếp" */
export function useSignPractice(modelUrl: string = MODEL_URL, labelsUrl: string = LABELS_URL) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const framesRef = useRef<Float32Array[]>([]);
  const recordingRef = useRef(false);
  const rafRef = useRef(0);
  const handsCountRef = useRef(-1);
  const hintRef = useRef<Hint>("none");

  const [phase, setPhase] = useState<Phase>("loading");
  const [count, setCount] = useState(3);
  const [handsVisible, setHandsVisible] = useState(0);
  const [hint, setHint] = useState<Hint>("none");
  const [modelReady, setModelReady] = useState(false);
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) return;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }

        const hl = await getHandLandmarker();
        // Model có thể chưa tồn tại (chưa train) -> KHÔNG được chặn UI
        let ok = false;
        try {
          await loadModel(modelUrl, labelsUrl);
          ok = true;
        } catch {
          /* chưa có model: vẫn chạy camera + khung xương */
        }
        if (cancelled) return;
        setModelReady(ok);

        const loop = () => {
          // Lấy canvas mỗi frame: canvas cũng có thể mount sau khi camera mở
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d") ?? null;
          const v = videoRef.current;
          // Thẻ <video> có thể được mount SAU khi camera mở (vd. bước "Xem mẫu"
          // chưa hiện khung camera) → gắn lại luồng mỗi khi thẻ mới xuất hiện.
          if (v && stream && v.srcObject !== stream) {
            v.srcObject = stream;
            v.play().catch(() => {});
          }
          if (v && v.readyState >= 2) {
            if (canvas && canvas.width !== v.videoWidth && v.videoWidth) {
              canvas.width = v.videoWidth;
              canvas.height = v.videoHeight;
            }
            const hands = detectHands(hl, v, performance.now());
            if (ctx && canvas) drawHands(ctx, hands, canvas.width, canvas.height);
            if (hands.length !== handsCountRef.current) {
              handsCountRef.current = hands.length;
              setHandsVisible(hands.length);
            }
            const h = computeHint(hands);
            if (h !== hintRef.current) {
              hintRef.current = h;
              setHint(h);
            }
            if (recordingRef.current && hands.length > 0) {
              framesRef.current.push(buildFrameFeatures(hands));
            }
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        setPhase("ready");
      } catch (e: any) {
        setCameraError(
          e?.message ?? "Không truy cập được camera. Kiểm tra quyền camera."
        );
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Đếm ngược -> quay -> dự đoán. Trả về Prediction, hoặc null nếu chưa có model / không thấy tay.
  const start = useCallback((): Promise<Prediction | null> => {
    return new Promise((resolve) => {
      framesRef.current = [];
      setCount(3);
      setPhase("countdown");
      let c = 3;
      const tick = setInterval(() => {
        c -= 1;
        if (c > 0) {
          setCount(c);
        } else {
          clearInterval(tick);
          setPhase("recording");
          recordingRef.current = true;
          setTimeout(async () => {
            recordingRef.current = false;
            const frames = framesRef.current;
            setPhase("result");
            if (frames.length < MIN_FRAMES) {
              resolve(null);
              return;
            }
            try {
              resolve((await predictTopK(modelUrl, resampleSequence(frames), 1))[0]);
            } catch {
              resolve(null); // model chưa sẵn sàng
            }
          }, RECORD_MS);
        }
      }, 1000);
    });
  }, [modelUrl]);

  return {
    videoRef,
    canvasRef,
    phase,
    setPhase,
    count,
    handsVisible,
    hint,
    modelReady,
    cameraError,
    start,
  };
}
