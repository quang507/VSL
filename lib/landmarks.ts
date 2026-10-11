// Chuẩn hoá landmark — PHẢI khớp y hệt training/landmark_utils.py
import {
  FEATURES_PER_HAND,
  FEATURES_PER_FRAME,
  FEATURES_PER_FRAME_FACE,
  FACE_LOC,
  WRIST,
  MIDDLE_MCP,
  MIDDLE_TIP,
  SEQ_LEN,
  NUM_LANDMARKS,
} from "./constants";
import type { FaceRef } from "./faceTracker";

export interface Pt {
  x: number;
  y: number;
  z: number;
}

export interface HandResult {
  label: "Left" | "Right";
  points: Pt[]; // 21 điểm
}

// (21 điểm) -> Float32Array(63) đã chuẩn hoá.
// aspect = cao/rộng của khung hình. MediaPipe trả x theo bề rộng, y theo chiều cao (đều 0..1),
// nên với khung không vuông bàn tay bị bóp méo. Model được train trên video VUÔNG (224×224);
// camera 4:3 làm mất ~3 điểm %, camera 16:9 mất ~17 điểm % nếu không bù (training/eval, 11/10/2026).
function normalizeHand(points: Pt[], aspect: number): Float32Array {
  const out = new Float32Array(FEATURES_PER_HAND);
  const wrist = points[WRIST];

  // dịch về gốc + tính thước đo tỉ lệ (cổ tay -> khớp ngón giữa)
  const mid = points[MIDDLE_MCP];
  const dx = mid.x - wrist.x;
  const dy = (mid.y - wrist.y) * aspect;
  const dz = mid.z - wrist.z;
  let scale = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (scale < 1e-6) scale = 1.0;

  for (let i = 0; i < NUM_LANDMARKS; i++) {
    const p = points[i];
    out[i * 3 + 0] = (p.x - wrist.x) / scale;
    out[i * 3 + 1] = ((p.y - wrist.y) * aspect) / scale;
    out[i * 3 + 2] = (p.z - wrist.z) / scale;
  }
  return out;
}

// 1 frame -> Float32Array(126) = [Left(63), Right(63)]
// Có `face` (model "face") -> Float32Array(136) = [Left(63 + 4), Right(63 + 4), phải − trái (2)]:
//   4 số vị trí mỗi tay = (cổ tay − tâm mặt), (đầu ngón giữa − tâm mặt), đơn vị = bề ngang mặt.
//   2 số cuối = cổ tay phải − cổ tay trái (cùng đơn vị), chỉ khi thấy cả hai tay.
//   Tay vắng mặt = toàn 0. Chưa dò được mặt (face = null) = phần vị trí toàn 0.
// PHẢI khớp y hệt featurize(feat="face") trong training/eval/try_models.py.
export function buildFrameFeatures(hands: HandResult[], aspect = 1, face?: FaceRef | null): Float32Array {
  const withFace = face !== undefined;
  const fh = FEATURES_PER_HAND + (withFace ? FACE_LOC : 0);
  const frame = new Float32Array(withFace ? FEATURES_PER_FRAME_FACE : FEATURES_PER_FRAME); // mặc định toàn 0
  const slot: Record<string, number> = { Left: 0, Right: 1 };
  const wrists: (readonly [number, number] | undefined)[] = [undefined, undefined];
  for (const h of hands) {
    const idx = slot[h.label];
    if (idx === undefined) continue;
    frame.set(normalizeHand(h.points, aspect), idx * fh);
    const w = h.points[WRIST];
    const wx = w.x, wy = w.y * aspect;
    wrists[idx] = [wx, wy];
    if (face) {
      const t = h.points[MIDDLE_TIP];
      const o = idx * fh + FEATURES_PER_HAND;
      frame[o] = (wx - face.cx) / face.w;
      frame[o + 1] = (wy - face.cy) / face.w;
      frame[o + 2] = (t.x - face.cx) / face.w;
      frame[o + 3] = (t.y * aspect - face.cy) / face.w;
    }
  }
  if (face && wrists[0] && wrists[1]) {
    frame[2 * fh] = (wrists[1][0] - wrists[0][0]) / face.w;
    frame[2 * fh + 1] = (wrists[1][1] - wrists[0][1]) / face.w;
  }
  return frame;
}

// (T frame) -> đúng SEQ_LEN frame bằng lấy mẫu tuyến tính (bề rộng frame lấy theo dữ liệu)
export function resampleSequence(frames: Float32Array[]): Float32Array {
  const T = frames.length;
  const F = T ? frames[0].length : FEATURES_PER_FRAME;
  const out = new Float32Array(SEQ_LEN * F);
  if (T === 0) return out;
  for (let i = 0; i < SEQ_LEN; i++) {
    const srcIdx = T === 1 ? 0 : Math.round((i * (T - 1)) / (SEQ_LEN - 1));
    out.set(frames[srcIdx], i * F);
  }
  return out;
}
