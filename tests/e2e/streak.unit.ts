import { test, expect } from "@playwright/test";
import { dayStreak, emptyProgress, settleStreakFreeze, type Progress } from "../../lib/progress";

const TODAY = "2026-10-18";
/** days: các ngày đạt mục tiêu (mặc định goal = 5) */
function prog(days: string[], extra: Partial<Progress> = {}): Progress {
  return { ...emptyProgress(), days: Object.fromEntries(days.map((d) => [d, 5])), ...extra };
}

test("học liên tục 3 ngày tới hôm qua, hôm nay chưa học: chuỗi 3, không tốn khiên", () => {
  const p = prog(["2026-10-15", "2026-10-16", "2026-10-17"]);
  expect(settleStreakFreeze(p, TODAY)).toBeNull();
  expect(dayStreak(p, TODAY)).toBe(3);
});

test("hụt 1 ngày: tiêu đúng 1 khiên, chuỗi giữ nguyên", () => {
  const p = prog(["2026-10-14", "2026-10-15", "2026-10-16"]); // hụt 17/10
  const s = settleStreakFreeze(p, TODAY)!;
  expect(s.streakFreeze).toBe(1);
  expect(s.freezeDays).toEqual(["2026-10-17"]);
  expect(dayStreak(s, TODAY)).toBe(3);
  expect(dayStreak(p, TODAY)).toBe(0); // chưa tiêu khiên thì chuỗi đứt
});

test("mở app nhiều lần trong ngày: chỉ tiêu khiên MỘT lần (lỗi cũ: không bao giờ trừ)", () => {
  const p = prog(["2026-10-15", "2026-10-16"]);
  const s = settleStreakFreeze(p, TODAY)!;
  expect(settleStreakFreeze(s, TODAY)).toBeNull();
  expect(s.streakFreeze).toBe(1);
});

test("hụt 2 ngày với 2 khiên: tiêu cả 2", () => {
  const s = settleStreakFreeze(prog(["2026-10-14", "2026-10-15"]), TODAY)!;
  expect(s.streakFreeze).toBe(0);
  expect(s.freezeDays).toEqual(["2026-10-17", "2026-10-16"]);
  expect(dayStreak(s, TODAY)).toBe(2);
});

test("hụt 3 ngày, chỉ có 2 khiên: chuỗi đứt, KHÔNG phí khiên", () => {
  const p = prog(["2026-10-13", "2026-10-14"]);
  expect(settleStreakFreeze(p, TODAY)).toBeNull();
  expect(dayStreak(p, TODAY)).toBe(0);
});

test("hết khiên: hụt 1 ngày là đứt chuỗi", () => {
  const p = prog(["2026-10-15", "2026-10-16"], { streakFreeze: 0 });
  expect(settleStreakFreeze(p, TODAY)).toBeNull();
  expect(dayStreak(p, TODAY)).toBe(0);
});

test("người dùng mới chưa học ngày nào: không tiêu khiên", () => {
  expect(settleStreakFreeze(prog([]), TODAY)).toBeNull();
});

test("hôm nay đã học + có ngày đã che trước đó: chuỗi tính qua ngày che", () => {
  const p = prog(["2026-10-15", "2026-10-17", TODAY], { freezeDays: ["2026-10-16"], streakFreeze: 1 });
  expect(dayStreak(p, TODAY)).toBe(3);
});
