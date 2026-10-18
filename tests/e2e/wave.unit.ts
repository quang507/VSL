import { test, expect } from "@playwright/test";
import { createWaveDetector, countTurns, WAVE } from "../../lib/waveDetector";
import type { HandResult, Pt } from "../../lib/landmarks";

/** Bàn tay giả: cổ tay ở (x, 0.5). open = xoè ngón hướng lên; ngược lại là nắm tay. */
function hand(x: number, open = true): HandResult {
  const p: Pt[] = Array.from({ length: 21 }, () => ({ x, y: 0.5, z: 0 }));
  p[0] = { x, y: 0.5, z: 0 };
  // khớp giữa (6, 10, 14, 18) ở y = 0.4; đầu ngón (8, 12, 16, 20) cao hơn nếu xoè, thấp hơn nếu nắm
  for (const [mid, tip] of [[6, 8], [10, 12], [14, 16], [18, 20]]) {
    p[mid] = { x, y: 0.4, z: 0 };
    p[tip] = { x, y: open ? 0.3 : 0.45, z: 0 };
  }
  p[4] = { x: x - 0.08, y: 0.4, z: 0 }; // ngón cái
  p[20] = { x: x + 0.08, y: open ? 0.3 : 0.45, z: 0 }; // ngón út
  return { label: "Right", points: p };
}

/** Chạy detector trên quỹ đạo x(t), 30 frame/giây; trả về các mốc thời gian (ms) đã kích hoạt */
function run(xs: (t: number) => number, ms: number, open = true, fps = 30) {
  const d = createWaveDetector();
  const fired: number[] = [];
  for (let t = 0; t <= ms; t += 1000 / fps) if (d.push(t, [hand(xs(t), open)])) fired.push(t);
  return fired;
}

const wave = (t: number) => 0.5 + 0.08 * Math.sin((2 * Math.PI * t) / 600); // vẫy ~1,7 lần/giây, biên độ ±0,08

test("giơ bàn tay xoè đứng yên 3 giây: KHÔNG kích hoạt (lỗi cũ)", () => {
  expect(run(() => 0.5, 3000)).toEqual([]);
});

test("bàn tay xoè rung nhẹ tại chỗ: không kích hoạt", () => {
  expect(run((t) => 0.5 + 0.01 * Math.sin(t / 40), 3000)).toEqual([]);
});

test("vẫy qua lại: kích hoạt đúng một lần trong 1,5 giây đầu", () => {
  const f = run(wave, 1500);
  expect(f.length).toBe(1);
  expect(f[0]).toBeLessThan(WAVE.WINDOW_MS);
});

test("vẫy liên tục 4 giây: các lần kích hoạt cách nhau ít nhất COOLDOWN", () => {
  const f = run(wave, 4000);
  expect(f.length).toBeGreaterThanOrEqual(1);
  for (let i = 1; i < f.length; i++) expect(f[i] - f[i - 1]).toBeGreaterThanOrEqual(WAVE.COOLDOWN_MS);
});

test("lướt tay một chiều (không đổi chiều): không kích hoạt", () => {
  expect(run((t) => 0.2 + (0.6 * t) / 2000, 2000)).toEqual([]);
});

test("nắm tay đưa qua lại (không xoè): không kích hoạt", () => {
  expect(run(wave, 3000, false)).toEqual([]);
});

test("máy yếu 6 lần dò/giây vẫn nhận ra cái vẫy chậm", () => {
  const slow = (t: number) => 0.5 + 0.1 * Math.sin((2 * Math.PI * t) / 1000);
  expect(run(slow, 2000, true, 6).length).toBe(1);
});

test("countTurns: trái → phải → trái = 2 lần đổi chiều", () => {
  expect(countTurns([0.5, 0.45, 0.4, 0.5, 0.6, 0.5, 0.4])).toBe(2);
  expect(countTurns([0.5, 0.51, 0.5, 0.51, 0.5])).toBe(0);
});
