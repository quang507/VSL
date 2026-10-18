"use client";

// Nhận diện LIÊN TỤC cho chế độ "Dịch ký hiệu": camera chạy suốt, tự tách từng lần ký.
// Một lần ký kết thúc khi: hạ tay khỏi khung, hoặc tay đứng yên ~0,5s, hoặc quá 3,5s (xem signSegmenter.ts).
import { useCallback, useEffect, useRef, useState } from "react";
import { cameraErrorText, openCamera, STALL_MS, type CameraHandle } from "./camera";
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

  const camRef = useRef<CameraHandle | null>(null);
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let lastAdvance = 0;
    let isStalled = false;
    const cam = openCamera({
      onError: (e) => !cancelled && setCameraError(cameraErrorText(e)),
      onReopen: () => !cancelled && setCameraError(""),
    });
    camRef.current = cam;
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
        if (!cancelled) cb.current(top);
      } catch {
        /* model chưa sẵn sàng */
      }
      busy = false;
      if (!cancelled) setS("idle");
    };

    (async () => {
      try {
        await cam.ready;
        if (cancelled) return;
        const hl = await getHandLandmarker();
        const fd = await getFaceDetector();
        if (cancelled) return;
        const loop = () => {
          const v = videoRef.current;
          const stream = cam.current();
          if (v && stream && v.srcObject !== stream) {
            v.srcObject = stream;
            v.play().catch(() => {});
          }
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d") ?? null;
          const now = performance.now();
          // Chỉ xử lý khi camera có frame MỚI (màn 60–120 Hz gọi loop nhiều hơn số frame camera)
          if (v && v.readyState >= 2 && v.currentTime !== lastVideoTime) {
            lastVideoTime = v.currentTime;
            lastAdvance = now;
            if (canvas && v.videoWidth && canvas.width !== v.videoWidth) {
              canvas.width = v.videoWidth;
              canvas.height = v.videoHeight;
            }
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
          } else if (!stream || !v) {
            // đang ở nền / đang mở lại camera / khung camera đang ẩn: không tính là đứng hình
            lastAdvance = now;
            segmenter.reset(); // không ghép nửa động tác trước và sau lúc camera bị ngắt
          }
          const s = now - lastAdvance > STALL_MS;
          if (s !== isStalled) {
            isStalled = s;
            setStalled(s);
            if (s) v?.play().catch(() => {}); // iOS đôi khi chỉ dừng thẻ <video> chứ luồng vẫn sống
          }
          raf = requestAnimationFrame(loop);
        };
        lastAdvance = performance.now();
        raf = requestAnimationFrame(loop);
        setS("idle");
      } catch (e: unknown) {
        if (!cancelled) setCameraError(cameraErrorText(e));
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      segmenter.reset();
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      cam.dispose();
      camRef.current = null;
    };
  }, [features]);

  /** Camera đứng hình (bị hệ điều hành ngắt) → người dùng chạm để mở lại */
  const resumeCamera = useCallback(() => {
    setStalled(false);
    void camRef.current?.reopen();
  }, []);

  return { videoRef, canvasRef, status, handsVisible, hint, faceSeen, modelReady, modelFailed, cameraError, stalled, resumeCamera, paused, setPaused };
}
