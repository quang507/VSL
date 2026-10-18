// Nhận diện cử chỉ VẪY TAY để bắt đầu ghi không cần chạm (chế độ bấm nút).
//
// Trước đây chỉ cần bàn tay xoè giơ cao trong 4 frame là kích hoạt → rất nhiều ký hiệu và chữ cái
// ngón tay có đúng hình tay đó, đang tập là app tự đếm ngược. Giờ phải VẪY THẬT: bàn tay xoè ở nửa
// trên khung, cổ tay đổi chiều ngang ít nhất 2 lần (trái → phải → trái) trong ~1,5 giây.
// Mọi ngưỡng tính theo thời gian, không theo số frame (máy yếu chỉ dò được ~5 lần/giây).
import type { HandResult } from "./landmarks";

export const WAVE = {
  WINDOW_MS: 1500, // các lần đổi chiều phải nằm trong khoảng này
  AMP: 0.04, // biên độ tối thiểu mỗi nhịp (toạ độ chuẩn hoá 0..1 theo bề ngang) — lọc rung tay
  TURNS: 2, // số lần đổi chiều: trái → phải → trái
  GAP_MS: 300, // mất bàn tay xoè lâu hơn chừng này thì làm lại từ đầu
  COOLDOWN_MS: 2000, // sau một lần vẫy, chờ chừng này mới nhận lần tiếp theo
};

/** Bàn tay xoè, các ngón hướng lên, ở nửa trên khung hình */
export function isOpenPalm(h: HandResult): boolean {
  const p = h.points;
  if (p.length < 21) return false;
  if (p[0].y > 0.75) return false; // cổ tay ở nửa trên khung
  const fingersUp = p[8].y < p[6].y && p[12].y < p[10].y && p[16].y < p[14].y && p[20].y < p[18].y;
  return fingersUp && Math.abs(p[4].x - p[20].x) > 0.1; // ngón cái và ngón út xoè rộng
}

/** Đếm số lần đổi chiều ngang có biên độ ≥ amp (có trễ, nên rung nhẹ không tính) */
export function countTurns(xs: number[], amp = WAVE.AMP): number {
  if (!xs.length) return 0;
  let dir = 0;
  let ext = xs[0]; // điểm xa nhất theo chiều đang đi
  let turns = 0;
  for (const x of xs) {
    if (dir === 0) {
      if (Math.abs(x - ext) >= amp) {
        dir = Math.sign(x - ext);
        ext = x;
      } else if (Math.abs(x - xs[0]) > Math.abs(ext - xs[0])) ext = x;
    } else if (dir > 0) {
      if (x > ext) ext = x;
      else if (ext - x >= amp) {
        turns++;
        dir = -1;
        ext = x;
      }
    } else if (x < ext) ext = x;
    else if (x - ext >= amp) {
      turns++;
      dir = 1;
      ext = x;
    }
  }
  return turns;
}

export function createWaveDetector() {
  let hist: { t: number; x: number }[] = [];
  let lastFire = -Infinity;
  return {
    /** Đưa vào một frame; trả về true đúng MỘT lần khi vừa nhận ra một cái vẫy tay. */
    push(now: number, hands: HandResult[]): boolean {
      const palm = hands.find(isOpenPalm);
      const last = hist[hist.length - 1];
      if (!palm) {
        if (last && now - last.t > WAVE.GAP_MS) hist = [];
        return false;
      }
      if (last && now - last.t > WAVE.GAP_MS) hist = [];
      hist.push({ t: now, x: palm.points[0].x });
      while (hist.length && now - hist[0].t > WAVE.WINDOW_MS) hist.shift();
      if (now - lastFire < WAVE.COOLDOWN_MS) return false;
      if (countTurns(hist.map((s) => s.x)) < WAVE.TURNS) return false;
      lastFire = now;
      hist = [];
      return true;
    },
    reset() {
      hist = [];
    },
  };
}
