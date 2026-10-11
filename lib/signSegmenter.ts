// Tách TỪNG LẦN KÝ ra khỏi luồng camera chạy liên tục (dùng cho tự chấm và Dịch ký hiệu).
//
// Mọi ngưỡng tính theo THỜI GIAN, không theo số frame: máy yếu chỉ dò tay được ~5 lần/giây,
// màn 120 Hz thì gọi 120 lần/giây, đếm frame sẽ sai ở cả hai đầu.
// Ngưỡng đo từ video mẫu (scripts/eval-auto-capture.mjs): tay đặt yên dao động ≤ 0,1 đơn vị/giây,
// tay đang ký ≥ 0,15. Có ký hiệu chỉ cử động ngón (cổ tay đứng im) nên phải xét cả đầu ngón tay.
import { buildFrameFeatures, type HandResult } from "./landmarks";

export const SEG = {
  WINDOW_MS: 200, // so với vị trí ~0,2 giây trước: đủ dài để nhiễu của bộ dò tay không bị tính là chuyển động
  STILL_SPEED: 0.12, // toạ độ chuẩn hoá (0..1) mỗi giây; dưới mức này coi là đứng yên
  STILL_MS: 500, // đứng yên chừng này thì chốt lần ký
  MIN_MOVE_MS: 350, // chuyển động ít hơn thế thì coi là cử động vu vơ, không chấm
  // Không thấy tay chừng này thì chốt. Phải dài: bộ dò hay mất dấu tay 0,5–0,9 giây ngay giữa lúc ký
  // (tay lướt nhanh, che mặt), chốt sớm sẽ cắt đôi động tác.
  GONE_MS: 1000,
  MAX_MS: 3500, // một lần ký dài nhất, tính từ lúc tay bắt đầu chuyển động
  MIN_FRAMES: 4,
  LEAD_FRAMES: 2, // giữ vài frame đứng yên ở hai đầu (model được train trên clip cắt sát)
};

// Cổ tay + đầu ngón cái, trỏ, giữa, út
const KEY_POINTS = [0, 4, 8, 12, 20];

type Sample = { t: number; p: number[] };
type Track = { hist: Sample[] };
type Frame = { f: Float32Array; moving: boolean };

function dist(a: number[], b: number[]) {
  let m = 0;
  for (let i = 0; i < a.length; i += 2) m = Math.max(m, Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]));
  return m;
}

export interface Segmenter {
  /** Đưa vào một frame camera. Trả về chuỗi đặc trưng khi vừa chốt xong một lần ký, ngược lại null. */
  push(now: number, hands: HandResult[]): Float32Array[] | null;
  /** Đang có động tác dở dang (để hiện "Đang xem bạn ký"). */
  readonly active: boolean;
  reset(): void;
}

export function createSegmenter(): Segmenter {
  let seg: Frame[] = [];
  let tracks: Track[] = [];
  let lastT = 0;
  let lastHand = 0;
  let moveStart = 0;
  let moveMs = 0;
  let stillSince = 0;

  const reset = () => {
    seg = [];
    tracks = [];
    lastT = 0;
    moveStart = 0;
    moveMs = 0;
    stillSince = 0;
  };

  // Tốc độ lớn nhất trong các bàn tay. Ghép tay với "vết" gần nhất của frame trước thay vì dựa
  // nhãn Left/Right, vì MediaPipe hay đổi nhãn giữa chừng (đổi nhãn sẽ thành một cú nhảy giả).
  const speed = (now: number, hands: HandResult[]) => {
    const free = tracks.filter((tr) => now - tr.hist[tr.hist.length - 1].t < SEG.GONE_MS);
    const next: Track[] = [];
    let best = 0;
    for (const h of hands) {
      const p = KEY_POINTS.flatMap((i) => [h.points[i].x, h.points[i].y]);
      let bi = -1;
      let bd = Infinity;
      free.forEach((tr, i) => {
        const d = dist(p, tr.hist[tr.hist.length - 1].p);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      // Xa hơn mức tay người đi được trong khoảng đó (~4 đơn vị/giây) thì là bàn tay khác vừa xuất hiện
      const gap = bi >= 0 ? now - free[bi].hist[free[bi].hist.length - 1].t : 0;
      const same = bi >= 0 && bd <= Math.max(0.2, (4 * gap) / 1000);
      const tr: Track = same ? free.splice(bi, 1)[0] : { hist: [] };
      tr.hist.push({ t: now, p });
      // hist[0] = mẫu mới nhất đã cũ ít nhất WINDOW_MS (chưa đủ thì là mẫu cũ nhất đang có)
      while (tr.hist.length > 2 && now - tr.hist[1].t >= SEG.WINDOW_MS) tr.hist.shift();
      if (tr.hist.length > 1) best = Math.max(best, (dist(p, tr.hist[0].p) * 1000) / (now - tr.hist[0].t));
      next.push(tr);
    }
    tracks = [...next, ...free];
    return best;
  };

  const cut = () => {
    const frames = seg;
    const moved = moveMs;
    reset();
    if (moved < SEG.MIN_MOVE_MS) return null;
    let a = frames.findIndex((x) => x.moving);
    if (a < 0) return null;
    let b = frames.length - 1;
    while (!frames[b].moving) b--;
    a = Math.max(0, a - SEG.LEAD_FRAMES);
    b = Math.min(frames.length - 1, b + SEG.LEAD_FRAMES);
    const core = frames.slice(a, b + 1).map((x) => x.f);
    return core.length >= SEG.MIN_FRAMES ? core : null;
  };

  return {
    get active() {
      return moveMs > 0;
    },
    reset,
    push(now, hands) {
      if (!hands.length) {
        if (seg.length && now - lastHand > SEG.GONE_MS) return cut();
        return null;
      }
      const dt = lastT ? Math.min(now - lastT, 500) : 0;
      const moving = speed(now, hands) > SEG.STILL_SPEED;
      lastT = now;
      lastHand = now;
      seg.push({ f: buildFrameFeatures(hands), moving });
      if (moving) {
        if (!moveStart) moveStart = now;
        moveMs += dt;
        stillSince = 0;
      } else if (!stillSince) stillSince = now;

      if (moveStart && now - moveStart > SEG.MAX_MS) return cut();
      if (stillSince && now - stillSince >= SEG.STILL_MS) {
        if (moveMs >= SEG.MIN_MOVE_MS) return cut();
        // Đứng yên lâu mà chưa ký gì đáng kể: bỏ phần cũ, chờ động tác mới.
        // (Giữ vài frame cuối làm đoạn đệm trước động tác sắp tới.)
        seg = seg.slice(-SEG.LEAD_FRAMES);
        moveStart = 0;
        moveMs = 0;
      }
      return null;
    },
  };
}
