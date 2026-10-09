// Khởi tạo MediaPipe HandLandmarker (chạy bằng WebAssembly trong browser)
import {
  HandLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";
import { NUM_HANDS } from "./constants";
import type { Pt, HandResult } from "./landmarks";

let landmarker: HandLandmarker | null = null;

export async function getHandLandmarker(): Promise<HandLandmarker> {
  if (landmarker) return landmarker;
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  const make = (delegate: "GPU" | "CPU") =>
    HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
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
}
