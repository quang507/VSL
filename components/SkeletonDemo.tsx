"use client";

import { useEffect, useRef, useState } from "react";
import { Gauge } from "lucide-react";
import type { DemoFrames } from "@/lib/phrases";

const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
const COLORS = ["#4a8cf5", "#3fab53"];

/** Phát lại một lần ký dưới dạng khung xương 2 bàn tay (thay cho video mẫu). */
export default function SkeletonDemo({ frames: raw, fps = 30 }: { frames: DemoFrames | null; fps?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !raw?.length) return;
    // bỏ frame chưa/không thấy tay ở đầu & cuối để mẫu hiện ngay
    const has = (f: number[]) => f.some((v) => v !== 0);
    const a = raw.findIndex(has);
    const b = raw.length - 1 - [...raw].reverse().findIndex(has);
    const frames = a < 0 ? raw : raw.slice(a, b + 1);
    const ctx = cv.getContext("2d")!;
    // khung nhìn: bao trọn mọi điểm của cả lần ký, có lề
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const f of frames)
      for (let i = 0; i < f.length; i += 2) {
        if (!f[i] && !f[i + 1]) continue;
        minX = Math.min(minX, f[i]); maxX = Math.max(maxX, f[i]);
        minY = Math.min(minY, f[i + 1]); maxY = Math.max(maxY, f[i + 1]);
      }
    const pad = 0.08;
    const span = Math.max(maxX - minX, maxY - minY) + pad * 2;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    let i = 0, raf = 0, last = 0;
    const step = 1000 / (slow ? fps / 2 : fps);
    const draw = (t: number) => {
      if (t - last >= step) {
        last = t;
        const W = cv.width, H = cv.height;
        ctx.clearRect(0, 0, W, H);
        const f = frames[i % frames.length];
        for (let h = 0; h < 2; h++) {
          const off = h * 42;
          if (!f[off] && !f[off + 1]) continue;
          const P = (k: number) => [((f[off + k * 2] - cx) / span + 0.5) * W, ((f[off + k * 2 + 1] - cy) / span + 0.5) * H];
          ctx.strokeStyle = COLORS[h];
          ctx.lineWidth = W / 70;
          ctx.lineCap = "round";
          for (const [a, b] of BONES) {
            const [x1, y1] = P(a), [x2, y2] = P(b);
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          }
          ctx.fillStyle = "#fff";
          for (let k = 0; k < 21; k++) {
            const [x, y] = P(k);
            ctx.beginPath(); ctx.arc(x, y, W / 90, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = COLORS[h]; ctx.lineWidth = 2; ctx.stroke();
          }
        }
        i++;
        if (i % frames.length === 0) last = t + 500; // nghỉ nửa giây giữa các lần lặp
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [raw, fps, slow]);

  return (
    <div className="media" style={{ aspectRatio: "1 / 1", background: "var(--brand-deep)" }}>
      <canvas ref={ref} width={600} height={600} style={{ width: "100%", height: "100%" }} aria-label="Hoạt hình khung xương bàn tay của câu mẫu" />
      {!raw && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>Đang tải mẫu…</div>
      )}
      <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between" }}>
        <button type="button" className="pill" onClick={() => setSlow(!slow)} style={{ background: "rgba(255,255,255,.18)", color: "#fff", border: "none", minHeight: 36 }} aria-label="Đổi tốc độ">
          <Gauge size={16} aria-hidden /> {slow ? "Chậm 0.5x" : "Tốc độ 1x"}
        </button>
        <span className="pill" style={{ background: "rgba(255,255,255,.18)", color: "#fff" }}>
          Khung xương tay
        </span>
      </div>
    </div>
  );
}
