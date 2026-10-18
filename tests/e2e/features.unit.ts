import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { buildFrameFeatures, type HandResult } from "../../lib/landmarks";
import { createFaceTracker } from "../../lib/faceTracker";
import { FEATURES_PER_FRAME_FACE } from "../../lib/constants";

/**
 * Đặc trưng "face" tính trong app phải khớp Y HỆT Python lúc train (training/eval/try_models.py),
 * không thì model nhận toàn số lạ. Dữ liệu đối chiếu: training/eval/dump_feat_ref.py.
 * Video train là hình vuông nên aspect = 1.
 */
interface Ref {
  video: string;
  hands: { label: "Left" | "Right"; points: number[][] }[][];
  face: number[][]; // [cx, cy, w, h] mỗi frame, 0 nếu không thấy
  features: number[][];
}
const refs: Ref[] = JSON.parse(readFileSync("tests/e2e/fixtures/face_features.json", "utf8"));
const toHands = (hs: Ref["hands"][number]): HandResult[] => hs.map((h) => ({ label: h.label, points: h.points.map(([x, y, z]) => ({ x, y, z })) }));

for (const r of refs) {
  test(`đặc trưng face khớp Python · ${r.video}`, () => {
    // Lúc train lấy trung vị mặt trên cả clip → nạp hết khung mặt vào bộ theo dõi trước
    const faces = createFaceTracker();
    for (const [cx, cy, w] of r.face) if (w > 0) faces.push({ cx, cy, w });
    const ref = faces.ref();
    expect(ref).not.toBeNull();
    let maxDiff = 0;
    r.hands.forEach((hands, t) => {
      const f = buildFrameFeatures(toHands(hands), 1, ref);
      expect(f.length).toBe(FEATURES_PER_FRAME_FACE);
      expect(r.features[t].length).toBe(FEATURES_PER_FRAME_FACE);
      for (let k = 0; k < f.length; k++) maxDiff = Math.max(maxDiff, Math.abs(f[k] - r.features[t][k]));
    });
    expect(maxDiff).toBeLessThan(1e-4);
  });
}

test("không có mặt: phần vị trí toàn 0, hình dạng tay vẫn có", () => {
  const hands = toHands(refs[0].hands.find((h) => h.length > 0)!);
  const f = buildFrameFeatures(hands, 1, null);
  expect(f.length).toBe(FEATURES_PER_FRAME_FACE);
  const slot = hands[0].label === "Left" ? 0 : 67;
  expect(Array.from(f.slice(slot, slot + 63)).some((v) => v !== 0)).toBe(true);
  expect(Array.from(f.slice(slot + 63, slot + 67))).toEqual([0, 0, 0, 0]);
});
