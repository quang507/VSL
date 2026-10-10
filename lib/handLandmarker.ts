// Khởi tạo MediaPipe HandLandmarker (chạy bằng WebAssembly trong browser).
// WASM và model nằm sẵn trong app (public/mediapipe, xem scripts/copy-mediapipe.mjs):
// không cần mạng, và luôn đúng phiên bản với thư viện JS.
import {
  HandLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";
import { NUM_HANDS } from "./constants";
import { asset } from "./base";
import type { Pt, HandResult } from "./landmarks";

let landmarker: HandLandmarker | null = null;

export async function getHandLandmarker(): Promise<HandLandmarker> {
  if (landmarker) return landmarker;
  const vision = await FilesetResolver.forVisionTasks(asset("/mediapipe/wasm"));
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
