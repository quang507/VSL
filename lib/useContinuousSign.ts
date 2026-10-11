"use client";

// Nhận diện LIÊN TỤC cho chế độ "Dịch ký hiệu": camera chạy suốt, tự tách từng lần ký.
// Một lần ký kết thúc khi: hạ tay khỏi khung, hoặc tay đứng yên ~0,5s, hoặc quá 3,5s (xem signSegmenter.ts).
import { useEffect, useRef, useState } from "react";
import { getHandLandmarker, detectHands, getFaceDetector, detectFace } from "./handLandmarker";
import { createFaceTracker } from "./faceTracker";
import type { FeatureKind } from "./constants";
import { loadModel, predictTopK, type Prediction } from "./classifier";
import { resampleSequence } from "./landmarks";
import { createSegmenter } from "./signSegmenter";
import { drawHands } from "./draw";
import { computeHint, type Hint } from "./useSignPractice";

export type Status = "loading" | "idle" | "watching" | "thinking";

export function useContinuousSign(modelUrl: string, labelsUrl: string, onResult: (top: Prediction[]) => void, features: FeatureKind = "hands") {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cb = useRef(onResult);
  cb.current = onResult;
  const modelRef = useRef(modelUrl);
  const featRef = useRef(features);
  featRef.current = features;
  const [faceSeen, setFaceSeen] = useState(true);

  const [status, setStatus] = useState<Status>("loading");
  const [handsVisible, setHandsVisible] = useState(0);
  const [hint, setHint] = useState<Hint>("none");
  const [modelReady, setModelReady] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  // Đổi model (từ ↔ câu) mà không mở lại camera
  useEffect(() => {
    modelRef.current = modelUrl;
    setModelReady(false);
    setModelFailed(false);
    loadModel(modelUrl, labelsUrl)
      .then(() => modelRef.current === modelUrl && setModelReady(true))
      .catch(() => modelRef.current === modelUrl && setModelFailed(true));
  }, [modelUrl, labelsUrl]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    let raf = 0;
    const segmenter = createSegmenter();
    const faces = createFaceTracker();
    let lastVideoTime = -1;
    let lastFaceSeen = true;
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

    const classify = async (core: Float32Array[]) => {
      busy = true;
      // Móc gỡ lỗi cho scripts/eval-auto-capture.mjs: xem app đưa gì vào model
      const dbg = (window as unknown as { __vslSegments?: number[][][] }).__vslSegments;
      if (dbg) dbg.push(core.map((f) => Array.from(f)));
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
        const fd = await getFaceDetector();
        if (cancelled) return;
        const loop = () => {
          const v = videoRef.current;
          if (v && stream && v.srcObject !== stream) {
            v.srcObject = stream;
            v.play().catch(() => {});
          }
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d") ?? null;
          // Chỉ xử lý khi camera có frame MỚI (màn 60–120 Hz gọi loop nhiều hơn số frame camera)
          if (v && v.readyState >= 2 && v.currentTime !== lastVideoTime) {
            lastVideoTime = v.currentTime;
            if (canvas && v.videoWidth && canvas.width !== v.videoWidth) {
              canvas.width = v.videoWidth;
              canvas.height = v.videoHeight;
            }
            const now = performance.now();
            const hands = detectHands(hl, v, now);
            if (ctx && canvas) drawHands(ctx, hands, canvas.width, canvas.height);
            const withFace = featRef.current === "face";
            if (withFace) {
              const f = detectFace(fd, v, now, hands);
              if (f && !f.covered) faces.push(f.face);
              if (!!f !== lastFaceSeen) {
                lastFaceSeen = !!f;
                setFaceSeen(!!f);
              }
            }
            if (hands.length !== lastCount) {
              lastCount = hands.length;
              setHandsVisible(hands.length);
            }
            const h = computeHint(hands);
            if (h !== lastHint) {
              lastHint = h;
              setHint(h);
            }

            if (pausedRef.current || busy) segmenter.reset();
            else {
              const core = segmenter.push(now, hands, v.videoHeight / v.videoWidth, withFace ? faces.ref() : undefined);
              if (core) void classify(core);
              else setS(segmenter.active ? "watching" : "idle");
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

  return { videoRef, canvasRef, status, handsVisible, hint, faceSeen, modelReady, modelFailed, cameraError, paused, setPaused };
}
