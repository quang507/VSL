import { test, expect } from "@playwright/test";
import { createSegmenter, SEG } from "../../lib/signSegmenter";
import type { HandResult } from "../../lib/landmarks";

/**
 * Bộ tách động tác của chế độ tự chấm, thử bằng chuyển động giả lập (không cần camera).
 * Mỗi kịch bản chạy ở nhiều tốc độ khung hình: máy yếu ~5 fps, video mẫu 12 fps, camera 30 fps,
 * màn 60 và 120 Hz. Kết quả phải như nhau.
 */
const FPS = [5, 12, 30, 60, 120];

// nhiễu cố định (không dùng Math.random để test ổn định)
function noise(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return (s / 4294967296 - 0.5) * 0.004; // ±0,002: mức rung của bộ dò tay khi tay đặt yên
  };
}

function hand(label: "Left" | "Right", x: number, y: number, spread = 0.08, n: () => number = () => 0): HandResult {
  // 21 điểm: cổ tay ở (x, y), các ngón xoè lên trên; spread = độ mở ngón
  const points = Array.from({ length: 21 }, (_, i) => ({
    x: x + (i === 0 ? 0 : ((i % 4) - 1.5) * 0.02) + n(),
    y: y - (i === 0 ? 0 : spread * (0.4 + ((i - 1) % 4) * 0.2)) + n(),
    z: 0,
  }));
  return { label, points };
}

type Scene = (t: number, n: () => number) => HandResult[];

/** Chạy một kịch bản dài `ms` ở tốc độ `fps`, trả về các lần ký đã tách được. */
function run(scene: Scene, ms: number, fps: number) {
  const seg = createSegmenter();
  const n = noise(7);
  const out: { at: number; frames: number }[] = [];
  for (let t = 1000; t <= 1000 + ms; t += 1000 / fps) {
    const core = seg.push(t, scene(t - 1000, n));
    if (core) out.push({ at: t - 1000, frames: core.length });
  }
  return out;
}

// Đưa tay từ (0.5, 0.8) lên (0.3, 0.3) rồi vẫy, trong khoảng [from, from + dur]
const sign =
  (from: number, dur: number): Scene =>
  (t, n) => {
    const k = Math.min(1, Math.max(0, (t - from) / dur));
    const wave = k > 0 && k < 1 ? Math.sin(k * Math.PI * 4) * 0.06 : 0;
    return [hand("Right", 0.5 - 0.2 * k + wave, 0.8 - 0.5 * k, 0.08, n)];
  };

for (const fps of FPS) {
  test.describe(`${fps} khung hình/giây`, () => {
    test("ký một từ rồi giữ yên: chấm đúng một lần, ngay sau khi dừng tay", () => {
      const out = run(sign(800, 1500), 5000, fps);
      expect(out).toHaveLength(1);
      // dừng tay ở 2300 ms → chốt trong khoảng 0,5–1,1 giây sau đó
      expect(out[0].at).toBeGreaterThan(2300 + SEG.STILL_MS - 1000 / fps);
      expect(out[0].at).toBeLessThan(2300 + 1100);
    });

    test("để tay trong khung 3,3 giây rồi mới ký: không bị cắt giữa chừng", () => {
      // Lỗi cũ: mốc 3,5 giây tính từ lúc thấy tay, nên ký lúc 3,3 giây bị cắt sau 0,2 giây.
      const out = run(sign(3300, 1500), 8000, fps);
      expect(out).toHaveLength(1);
      expect(out[0].at).toBeGreaterThan(4800); // chốt SAU khi ký xong (3300 + 1500)
      expect(out[0].frames).toBeGreaterThanOrEqual(Math.floor((1500 * fps) / 1000) - 2); // đủ cả động tác
    });

    test("tay đặt yên 10 giây (có rung nhẹ): không chấm lần nào", () => {
      const out = run((_, n) => [hand("Left", 0.6, 0.7, 0.08, n), hand("Right", 0.4, 0.7, 0.08, n)], 10_000, fps);
      expect(out).toEqual([]);
    });

    test("giật tay một cái rất ngắn: không chấm", () => {
      const out = run((t, n) => [hand("Right", 0.5 + (t > 2000 && t < 2100 ? 0.05 : 0), 0.7, 0.08, n)], 6000, fps);
      expect(out).toEqual([]);
    });

    test("chỉ cử động ngón tay, cổ tay đứng im: vẫn chấm", () => {
      const out = run((t, n) => [hand("Right", 0.5, 0.6, t > 1000 && t < 2400 ? 0.08 + 0.05 * Math.sin(t / 90) : 0.08, n)], 5000, fps);
      expect(out).toHaveLength(1);
    });

    test("bộ dò đổi nhãn Trái/Phải trên bàn tay đứng yên: không chấm", () => {
      const out = run((t, n) => [hand(Math.floor(t / 300) % 2 ? "Left" : "Right", 0.5, 0.6, 0.08, n)], 8000, fps);
      expect(out).toEqual([]);
    });

    test("ký xong hạ tay ra khỏi khung: chấm sau khi mất tay", () => {
      const s = sign(500, 1500);
      const out = run((t, n) => (t < 2000 ? s(t, n) : []), 5000, fps);
      expect(out).toHaveLength(1);
      expect(out[0].at).toBeGreaterThan(2000 + SEG.GONE_MS - 1000 / fps - 1); // frame cuối còn tay nằm ngay trước mốc 2000
      expect(out[0].at).toBeLessThan(2000 + SEG.GONE_MS + 2000 / fps + 1);
    });

    test("cử động liên tục không dừng: tự chốt sau tối đa 3,5 giây", () => {
      const out = run((t, n) => [hand("Right", 0.5 + 0.2 * Math.sin(t / 200), 0.5, 0.08, n)], 9000, fps);
      expect(out.length).toBeGreaterThanOrEqual(2);
      expect(out[0].at).toBeLessThan(SEG.MAX_MS + SEG.WINDOW_MS + 2000 / fps);
    });
  });
}
