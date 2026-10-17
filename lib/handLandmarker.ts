// Khởi tạo MediaPipe HandLandmarker (chạy bằng WebAssembly trong browser).
// WASM và model nằm sẵn trong app (public/mediapipe, xem scripts/copy-mediapipe.mjs):
// không cần mạng, và luôn đúng phiên bản với thư viện JS.
import {
  HandLandmarker,
  FaceDetector,
  FilesetResolver,
} from "@mediapipe/tasks-vision";
import type { FaceRef } from "./faceTracker";
import { NUM_HANDS } from "./constants";
import { asset } from "./base";
import type { Pt, HandResult } from "./landmarks";

let landmarker: HandLandmarker | null = null;
let faceDetector: FaceDetector | null = null;
let visionP: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;
const getVision = () => (visionP ??= FilesetResolver.forVisionTasks(asset("/mediapipe/wasm")));

/** Bộ dò mặt (BlazeFace tầm gần, 230 KB): chỉ cần khung mặt làm mốc cho vị trí tay. */
export async function getFaceDetector(): Promise<FaceDetector> {
  if (faceDetector) return faceDetector;
  const vision = await getVision();
  const make = (delegate: "GPU" | "CPU") =>
    FaceDetector.createFromOptions(vision, {
      baseOptions: { modelAssetPath: asset("/mediapipe/blaze_face_short_range.tflite"), delegate },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.5,
    });
  try {
    faceDetector = await make("GPU");
  } catch {
    faceDetector = await make("CPU");
  }
  return faceDetector;
}

export interface FaceSeen {
  /** Mặt to nhất trong frame, toạ độ như FaceRef (y đã nhân aspect) */
  face: FaceRef;
  /** Có điểm bàn tay nào nằm trong khung mặt (nới 15%) → khung lúc này không đáng tin làm mốc */
  covered: boolean;
}

let lastHandTimestamp = -1;
let lastFaceTimestamp = -1;

/** null nếu không thấy mặt. */
export function detectFace(fd: FaceDetector, video: HTMLVideoElement, timestampMs: number, hands: HandResult[] = []): FaceSeen | null {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return null;
  if (timestampMs < lastFaceTimestamp - 1000) lastFaceTimestamp = -1;
  if (timestampMs <= lastFaceTimestamp) return null;
  lastFaceTimestamp = timestampMs;
  try {
    let box: { x0: number; y0: number; x1: number; y1: number } | null = null, area = 0;
    for (const d of fd.detectForVideo(video, timestampMs).detections) {
      const b = d.boundingBox;
      if (!b || b.width * b.height <= area) continue;
      area = b.width * b.height;
      box = { x0: b.originX / w, y0: b.originY / h, x1: (b.originX + b.width) / w, y1: (b.originY + b.height) / h };
    }
    if (!box) return null;
    const mx = (box.x1 - box.x0) * 0.15, my = (box.y1 - box.y0) * 0.15;
    const covered = hands.some((hd) => hd.points.some((p) => p.x > box!.x0 - mx && p.x < box!.x1 + mx && p.y > box!.y0 - my && p.y < box!.y1 + my));
    return { face: { cx: (box.x0 + box.x1) / 2, cy: ((box.y0 + box.y1) / 2) * (h / w), w: box.x1 - box.x0 }, covered };
  } catch (err) {
    console.warn("FaceDetector error:", err);
    return null;
  }
}

export async function getHandLandmarker(): Promise<HandLandmarker> {
  if (landmarker) return landmarker;
  const vision = await getVision();
  const make = (delegate: "GPU" | "CPU") =>
    HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: asset("/mediapipe/hand_landmarker.task"),
        delegate,
      },
      runningMode: "VIDEO",
      numHands: NUM_HANDS,
    });
  // Một số máy (nhất là iPhone/Safari cũ) không tạo được GPU delegate → lùi về CPU
  try {
    landmarker = await make("GPU");
  } catch {
    landmarker = await make("CPU");
  }
  return landmarker;
}

// Chạy detect trên 1 frame video -> danh sách tay đã gắn nhãn Left/Right
export function detectHands(
  hl: HandLandmarker,
  video: HTMLVideoElement,
  timestampMs: number
): HandResult[] {
  if (timestampMs < lastHandTimestamp - 1000) lastHandTimestamp = -1;
  if (timestampMs <= lastHandTimestamp) return [];
  lastHandTimestamp = timestampMs;
  try {
    const res = hl.detectForVideo(video, timestampMs);
    const out: HandResult[] = [];
    if (res.landmarks && res.handedness) {
      for (let i = 0; i < res.landmarks.length; i++) {
        const handed = res.handedness[i][0]?.categoryName as
          | "Left"
          | "Right";
        const points: Pt[] = res.landmarks[i].map((p) => ({
          x: p.x,
          y: p.y,
          z: p.z,
        }));
        out.push({ label: handed, points });
      }
    }
    return out;
  } catch (err) {
    console.warn("HandLandmarker error:", err);
    return [];
  }
}
