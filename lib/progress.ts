// Lưu tiến độ học vào localStorage (chạy trong browser, không cần server)
const KEY = "vsl-progress-v1";

export interface WordStat {
  attempts: number;
  correct: number;
  // Ôn tập lặp lại kiểu Leitner (tùy chọn — dữ liệu cũ không có cũng chạy)
  box?: number; // hộp 0..5, càng cao nhớ càng chắc
  due?: number; // mốc thời gian (ms) nên ôn lại
  last?: number; // lần ôn gần nhất (ms)
}

export interface Progress {
  words: Record<string, WordStat>;
  streak: number; // số lần đúng liên tiếp gần nhất
  bestStreak: number;
  score: number; // tổng điểm / XP (mỗi lần đúng +10)
  days: Record<string, number>; // "YYYY-MM-DD" -> số lần đúng trong ngày
  dailyGoal: number; // mục tiêu số từ đúng mỗi ngày
  soundOn: boolean; // bật âm thanh + rung
  streakFreeze?: number; // khiên bảo vệ chuỗi ngày học CÒN LẠI (mặc định tặng 2 khiên)
  freezeDays?: string[]; // các ngày "YYYY-MM-DD" đã được khiên che (mỗi ngày tốn 1 khiên)
  passedCheckpoints?: string[]; // id các chặng đã vượt bài thi Checkpoint (≥80%) → mở khóa chặng kế
  claimedChests?: string[]; // id các rương báu đã nhận thưởng (không nhận lại được)
}

export function emptyProgress(): Progress {
  return {
    words: {},
    streak: 0,
    bestStreak: 0,
    score: 0,
    days: {},
    dailyGoal: 5,
    soundOn: true,
    streakFreeze: 2,
    passedCheckpoints: [],
    claimedChests: [],
  };
}

export function loadProgress(): Progress {
  if (typeof window === "undefined") return emptyProgress();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const p: Progress = { ...emptyProgress(), ...JSON.parse(raw) };
    // Hụt ngày học: tiêu khiên ngay khi mở app để giữ chuỗi (chỉ làm một lần cho mỗi ngày hụt)
    const settled = settleStreakFreeze(p);
    if (settled) save(settled);
    return settled ?? p;
  } catch {
    return emptyProgress();
  }
}

function save(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* bỏ qua nếu localStorage bị chặn */
  }
}

// ---- Ngày (theo giờ máy người dùng) ----
export function dayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + delta));
}

// ---- Khoảng cách ôn lại theo hộp Leitner (giờ) ----
const BOX_HOURS = [0, 8, 24, 72, 168, 336]; // 0=ngay, rồi 8h,1d,3d,7d,14d
const HOUR = 3600_000;

// Ghi lại 1 lần luyện -> trả về tiến độ mới
export function recordAttempt(word: string, ok: boolean): Progress {
  const p = loadProgress();
  const now = Date.now();
  const stat = p.words[word] ?? { attempts: 0, correct: 0, box: 0 };
  stat.attempts += 1;

  if (ok) {
    stat.correct += 1;
    stat.box = Math.min((stat.box ?? 0) + 1, BOX_HOURS.length - 1);
    p.streak += 1;
    p.score += 10;
    p.bestStreak = Math.max(p.bestStreak, p.streak);
    const today = dayKey();
    p.days[today] = (p.days[today] ?? 0) + 1;
  } else {
    stat.box = 0; // sai -> về hộp đầu, ôn lại sớm
    p.streak = 0;
  }
  stat.last = now;
  stat.due = now + BOX_HOURS[stat.box ?? 0] * HOUR;
  p.words[word] = stat;
  save(p);
  return p;
}

// ---- Từ đã thuộc ----
export function isLearned(p: Progress, word: string): boolean {
  return (p.words[word]?.correct ?? 0) > 0;
}

export function countLearned(p: Progress, words: string[]): number {
  return words.filter((w) => isLearned(p, w)).length;
}

// ---- Streak theo ngày ----
// Hôm nay đã đạt mục tiêu chưa
export function goalMetToday(p: Progress): boolean {
  return (p.days[dayKey()] ?? 0) >= p.dailyGoal;
}

export function todayCount(p: Progress): number {
  return p.days[dayKey()] ?? 0;
}

// ---- Khiên bảo vệ chuỗi (Streak Freeze) ----
// Trước đây dayStreak cho "mượn" 2 khiên ảo mỗi lần tính mà không bao giờ trừ → ai cũng được
// bỏ 2 ngày bất kỳ miễn phí, số khiên hiển thị mãi là 2. Giờ khiên là thứ TIÊU HAO thật:
// mỗi ngày hụt được che sẽ ghi vào freezeDays và trừ 1 khiên.
const met = (p: Progress, d: string) => (p.days[d] ?? 0) >= p.dailyGoal;
const frozen = (p: Progress, d: string) => !!p.freezeDays?.includes(d);

/**
 * Che các ngày hụt NGAY TRƯỚC hôm nay bằng khiên, nếu đủ khiên để nối liền chuỗi cũ.
 * Hụt nhiều ngày hơn số khiên → chuỗi đứt hẳn, KHÔNG phí khiên. Hôm nay chưa xét (còn đang học).
 * Trả về tiến độ mới nếu có tiêu khiên, ngược lại null.
 */
export function settleStreakFreeze(p: Progress, today = dayKey()): Progress | null {
  const left = p.streakFreeze ?? 2;
  if (left <= 0) return null;
  const gap: string[] = [];
  let d = addDays(today, -1);
  while (!met(p, d) && !frozen(p, d)) {
    gap.push(d);
    if (gap.length > left) return null; // không đủ khiên (hoặc chưa từng học): để chuỗi đứt
    d = addDays(d, -1);
  }
  if (!gap.length) return null; // hôm qua đã học / đã được che
  return { ...p, streakFreeze: left - gap.length, freezeDays: [...(p.freezeDays ?? []), ...gap] };
}

// Số ngày liên tiếp đạt mục tiêu (tính lùi từ hôm nay; nếu hôm nay chưa
// đạt thì tính lùi từ hôm qua để streak chưa bị mất trong ngày).
// Ngày được khiên che giữ cho chuỗi không đứt nhưng không cộng thêm ngày.
export function dayStreak(p: Progress, today = dayKey()): number {
  let n = met(p, today) ? 1 : 0;
  let cursor = addDays(today, -1);
  while (met(p, cursor) || frozen(p, cursor)) {
    if (met(p, cursor)) n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

// ---- XP / cấp độ (mỗi cấp 100 XP) ----
export function levelInfo(score: number) {
  const SIZE = 100;
  const level = Math.floor(score / SIZE) + 1;
  const into = score % SIZE;
  return { level, into, size: SIZE, pct: Math.round((into / SIZE) * 100) };
}

// ---- Sức mạnh trí nhớ của từ (0..100%) ----
export function wordStrength(stat?: WordStat, now = Date.now()): number {
  if (!stat || stat.correct <= 0) return 0;
  const box = stat.box ?? 1;
  const last = stat.last ?? now;
  const due = stat.due ?? (last + 24 * 3600_000);
  
  if (now <= last) return 100;
  if (now >= due) {
    const overdueHours = (now - due) / 3600_000;
    // Tụt dần theo thời gian quá hạn ôn tập, tối thiểu còn 20%
    return Math.max(20, Math.round(50 - overdueHours * 2));
  }
  // Đang trong hạn ôn: từ 100% tụt dần về 60%
  const totalDuration = due - last;
  const elapsed = now - last;
  const ratio = Math.min(1, Math.max(0, elapsed / totalDuration));
  return Math.round(100 - ratio * 40);
}

// ---- Ôn tập lặp lại: từ đã học mà tới hạn ôn ----
export function dueWords(p: Progress, labels: string[], now = Date.now()): string[] {
  const set = new Set(labels);
  return Object.entries(p.words)
    .filter(([w, s]) => set.has(w) && s.correct > 0 && ((s.due ?? 0) <= now || (s.box ?? 0) < 2))
    .sort((a, b) => (a[1].due ?? 0) - (b[1].due ?? 0))
    .map(([w]) => w);
}

// ---- Đánh dấu các từ đã hoàn thành (dùng cho Placement Test vượt cấp) ----
export function markWordsLearned(words: string[]): Progress {
  const p = loadProgress();
  const now = Date.now();
  for (const w of words) {
    if (!p.words[w] || p.words[w].correct === 0) {
      p.words[w] = {
        attempts: 1,
        correct: 1,
        box: 2,
        last: now,
        due: now + 72 * 3600_000,
      };
      p.score += 10;
    }
  }
  save(p);
  return p;
}

// ---- Cài đặt ----
export function setDailyGoal(goal: number): Progress {
  const p = loadProgress();
  p.dailyGoal = goal;
  save(p);
  return p;
}

export function setSoundOn(on: boolean): Progress {
  const p = loadProgress();
  p.soundOn = on;
  save(p);
  return p;
}

export function resetProgress() {
  save(emptyProgress());
}

// ---- Trạm kiểm soát vượt chặng (Unit Checkpoint Exam) ----
export function isCheckpointPassed(p: Progress, lessonId: string): boolean {
  return !!p.passedCheckpoints?.includes(lessonId);
}

/** Ghi nhận đã vượt Checkpoint của một chặng (đạt ≥80%). Gọi nhiều lần không nhân đôi. */
export function recordCheckpoint(lessonId: string): Progress {
  const p = loadProgress();
  if (!p.passedCheckpoints?.includes(lessonId)) {
    p.passedCheckpoints = [...(p.passedCheckpoints ?? []), lessonId];
    save(p);
  }
  return p;
}

/** Chặng mở khóa khi đã vượt Checkpoint của chặng ngay trước (chặng đầu luôn mở). */
export function isLessonUnlocked(p: Progress, lessons: { id: string }[], index: number): boolean {
  if (index <= 0) return true;
  const prev = lessons[index - 1];
  return !!prev && isCheckpointPassed(p, prev.id);
}

// ---- Rương báu cột mốc (Treasure Chest Milestone) ----
export function isChestClaimed(p: Progress, chestId: string): boolean {
  return !!p.claimedChests?.includes(chestId);
}

/** Nhận thưởng rương (1 lần/rương): +20 XP và +1 khiên bảo vệ chuỗi. */
export function claimChest(chestId: string): Progress {
  const p = loadProgress();
  if (p.claimedChests?.includes(chestId)) return p;
  p.claimedChests = [...(p.claimedChests ?? []), chestId];
  p.score += 20;
  p.streakFreeze = (p.streakFreeze ?? 2) + 1;
  save(p);
  return p;
}
