// Mốc "mặt" để biết bàn tay đang ở đâu so với cơ thể (xem buildFrameFeatures).
// Lúc train lấy TRUNG VỊ vị trí và bề ngang mặt trên cả clip (người ký đứng yên), mà clip
// phần lớn là lúc tay CHƯA che mặt. Trong app người dùng cũng đứng yên, nên lấy trung vị của
// các lần dò mặt gần nhất, cửa sổ dài (~10 giây) và bỏ những frame có tay đè lên mặt: lúc đó
// bộ dò hay trả khung to hơn hoặc nhận nhầm bàn tay là mặt (đo 11/10/2026: "Bệnh nhân" sai vì thế).
// Toạ độ: x theo bề rộng khung, y đã nhân aspect (cao/rộng) để cùng đơn vị với x.

export interface FaceRef {
  cx: number;
  cy: number;
  w: number; // bề ngang mặt, đơn vị = bề rộng khung
}

const WINDOW = 240; // ~10 giây ở 24 lần dò/giây: phải dài hơn một lần ký, để trung vị là lúc mặt không bị che

function median(a: number[]) {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function createFaceTracker() {
  const cx: number[] = [];
  const cy: number[] = [];
  const w: number[] = [];
  let cached: FaceRef | null = null;
  return {
    push(f: FaceRef) {
      cx.push(f.cx);
      cy.push(f.cy);
      w.push(f.w);
      if (cx.length > WINDOW) {
        cx.shift();
        cy.shift();
        w.shift();
      }
      cached = null;
    },
    /** null khi chưa dò được mặt lần nào */
    ref(): FaceRef | null {
      if (!cx.length) return null;
      return (cached ??= { cx: median(cx), cy: median(cy), w: median(w) });
    },
    get seen() {
      return cx.length > 0;
    },
    reset() {
      cx.length = cy.length = w.length = 0;
      cached = null;
    },
  };
}

export type FaceTracker = ReturnType<typeof createFaceTracker>;
