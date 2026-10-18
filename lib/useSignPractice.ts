"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getHandLandmarker, detectHands, getFaceDetector, detectFace } from "./handLandmarker";
import { createFaceTracker } from "./faceTracker";
import type { FeatureKind } from "./constants";
import { loadModel, predictTopK, type Prediction } from "./classifier";
import { MODEL_URL, LABELS_URL } from "./constants";
import { buildFrameFeatures, resampleSequence, type HandResult } from "./landmarks";
import { drawHands } from "./draw";
import { cameraErrorText, openCamera, STALL_MS, type CameraHandle } from "./camera";
import { createWaveDetector } from "./waveDetector";

export type Phase = "loading" | "ready" | "countdown" | "recording" | "result";

const RECORD_MS = 2500; // thời gian quay mỗi lần ký hiệu
const MIN_FRAMES = 6; // ít hơn số frame có tay này thì coi như "không thấy tay"

/** Gợi ý tư thế hiển thị trực tiếp trên khung camera */
export type Hint = "none" | "edge" | "close" | "far" | "ok" | "noface";

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
export function useSignPractice(modelUrl: string = MODEL_URL, labelsUrl: string = LABELS_URL, features: FeatureKind = "hands") {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const framesRef = useRef<Float32Array[]>([]);
  const recordingRef = useRef(false);
  const rafRef = useRef(0);
  const handsCountRef = useRef(-1);
  const hintRef = useRef<Hint>("none");
  const faceSeenRef = useRef(true);
  const [faceSeen, setFaceSeen] = useState(true);

  const [phase, setPhase] = useState<Phase>("loading");
  const [count, setCount] = useState(3);
  const [handsVisible, setHandsVisible] = useState(0);
  const [hint, setHint] = useState<Hint>("none");
  const [modelReady, setModelReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  /** Tăng 1 mỗi lần nhận ra một cái vẫy tay (xem waveDetector.ts) */
  const [waveTick, setWaveTick] = useState(0);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const camRef = useRef<CameraHandle | null>(null);
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    let cancelled = false;
    let lastVideoTime = -1;
    let lastAdvance = 0;
    let isStalled = false;
    const cam = openCamera({
      onError: (e) => !cancelled && setCameraError(cameraErrorText(e)),
      onReopen: () => !cancelled && setCameraError(""),
    });
    camRef.current = cam;

    (async () => {
      try {
        await cam.ready;
        if (cancelled) return;
        const video = videoRef.current;
        const first = cam.current();
        if (video && first) {
          video.srcObject = first;
          await video.play();
        }

        const hl = await getHandLandmarker();
        const fd = features === "face" ? await getFaceDetector() : null;
        const faces = createFaceTracker();
        const waves = createWaveDetector();
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
          const stream = cam.current();
          // Thẻ <video> có thể được mount SAU khi camera mở (vd. bước "Xem mẫu"
          // chưa hiện khung camera), hoặc luồng vừa được mở lại → gắn lại luồng.
          if (v && stream && v.srcObject !== stream) {
            v.srcObject = stream;
            v.play().catch(() => {});
          }
          const now = performance.now();
          // Chỉ xử lý khi camera có frame MỚI (màn 60–120 Hz gọi loop nhiều hơn số frame camera)
          if (v && v.readyState >= 2 && v.currentTime !== lastVideoTime) {
            lastVideoTime = v.currentTime;
            lastAdvance = now;
            if (canvas && canvas.width !== v.videoWidth && v.videoWidth) {
              canvas.width = v.videoWidth;
              canvas.height = v.videoHeight;
            }
            const hands = detectHands(hl, v, now);
            if (ctx && canvas) drawHands(ctx, hands, canvas.width, canvas.height);
            if (fd) {
              const f = detectFace(fd, v, now, hands);
              if (f && !f.covered) faces.push(f.face);
              if (!!f !== faceSeenRef.current) {
                faceSeenRef.current = !!f;
                setFaceSeen(!!f);
              }
            }
            if (hands.length !== handsCountRef.current) {
              handsCountRef.current = hands.length;
              setHandsVisible(hands.length);
            }
            const h = computeHint(hands);
            if (h !== hintRef.current) {
              hintRef.current = h;
              setHint(h);
            }

            // Vẫy tay thật (đổi chiều qua lại) để bắt đầu ghi không cần chạm; đang ghi thì không xét
            if (recordingRef.current) waves.reset();
            else if (waves.push(now, hands)) setWaveTick((t) => t + 1);

            if (recordingRef.current && hands.length > 0) {
              framesRef.current.push(buildFrameFeatures(hands, v.videoHeight / v.videoWidth, fd ? faces.ref() : undefined));
            }
          } else if (!stream || !v) {
            // đang ở nền / đang mở lại camera / khung camera đang ẩn: không tính là đứng hình
            lastAdvance = now;
          }
          const s = now - lastAdvance > STALL_MS;
          if (s !== isStalled) {
            isStalled = s;
            setStalled(s);
            if (s) v?.play().catch(() => {}); // iOS đôi khi chỉ dừng thẻ <video> chứ luồng vẫn sống
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        lastAdvance = performance.now();
        rafRef.current = requestAnimationFrame(loop);
        setPhase("ready");
      } catch (e: unknown) {
        if (!cancelled) setCameraError(cameraErrorText(e));
      }
    })();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      cancelAnimationFrame(rafRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (recordTimeoutRef.current) clearTimeout(recordTimeoutRef.current);
      recordingRef.current = false;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      cam.dispose();
      camRef.current = null;
    };
  }, [modelUrl, labelsUrl, features]);

  /** Camera đứng hình (bị hệ điều hành ngắt) → người dùng chạm để mở lại */
  const resumeCamera = useCallback(() => {
    setStalled(false);
    void camRef.current?.reopen();
  }, []);

  // Đếm ngược -> quay -> dự đoán. Trả về Prediction, hoặc null nếu chưa có model / không thấy tay.
  const start = useCallback((): Promise<Prediction | null> => {
    return new Promise((resolve) => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (recordTimeoutRef.current) clearTimeout(recordTimeoutRef.current);

      framesRef.current = [];
      setCount(3);
      setPhase("countdown");
      let c = 3;
      countdownTimerRef.current = setInterval(() => {
        if (!isMountedRef.current) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          resolve(null);
          return;
        }
        c -= 1;
        if (c > 0) {
          setCount(c);
        } else {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          setPhase("recording");
          recordingRef.current = true;
          recordTimeoutRef.current = setTimeout(async () => {
            recordingRef.current = false;
            const frames = framesRef.current;
            if (!isMountedRef.current) {
              resolve(null);
              return;
            }
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
    faceSeen,
    modelReady,
    cameraError,
    stalled,
    resumeCamera,
    waveTick,
    start,
  };
}
