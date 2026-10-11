"use client";

import { useState, type RefObject, type ReactNode } from "react";
import { Hand, ScanFace, CameraOff, MoveHorizontal, ZoomOut, ZoomIn } from "lucide-react";
import type { Hint, Phase } from "@/lib/useSignPractice";
import { Pill } from "./ui";

/** Khung camera dùng chung cho Luyện tập và Đố vui: video gương + khung xương tay + đếm ngược. */
export default function CameraStage({
  videoRef,
  canvasRef,
  phase,
  count,
  handsVisible,
  veil,
  corner,
  error,
  hint = "none",
}: {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  phase: Phase;
  count: number;
  handsVisible: number;
  veil?: ReactNode;
  /** Ô nhỏ ở góc dưới phải, ví dụ video mẫu để vừa nhìn vừa ký theo. */
  corner?: ReactNode;
  error?: boolean;
  hint?: Hint;
}) {
  // Khung theo đúng tỉ lệ camera: webcam laptop ngang 4:3, điện thoại dọc → không bị cắt mất tay
  const [ratio, setRatio] = useState<string | undefined>();
  return (
    <div className="cam" style={ratio ? { aspectRatio: ratio } : undefined}>
      <video
        ref={videoRef}
        playsInline
        muted
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.videoWidth && v.videoHeight) setRatio(`${v.videoWidth} / ${v.videoHeight}`);
        }}
      />
      <canvas ref={canvasRef} />
      <div className={`cam-frame cam-frame--${hint}`} aria-hidden />
      <div className="cam-chip" aria-live="polite">
        <HintChip hint={hint} hands={handsVisible} />
      </div>
      {phase === "recording" && (
        <div className="cam-rec">
          <Pill bg="var(--red)" fg="#fff">
            ● Đang ghi
          </Pill>
        </div>
      )}
      {error ? (
        <div className="cam-veil">
          <span className="col" style={{ alignItems: "center", gap: 10 }}>
            <CameraOff size={40} aria-hidden />
            Camera chưa được bật
          </span>
        </div>
      ) : (
        phase === "loading" && <div className="cam-veil">Đang mở camera…</div>
      )}
      {phase === "countdown" && (
        <div className="cam-count" aria-live="assertive">
          {count}
        </div>
      )}
      {corner && !error && <div className="cam-pip">{corner}</div>}
      {veil && <div className="cam-veil">{veil}</div>}
    </div>
  );
}

const HINTS: Record<Hint, { text: string; icon: typeof Hand; bg: string; fg: string }> = {
  none: { text: "Đưa tay vào khung", icon: ScanFace, bg: "rgba(255,255,255,.92)", fg: "var(--txt)" },
  edge: { text: "Tay sắp ra ngoài khung", icon: MoveHorizontal, bg: "var(--yel)", fg: "var(--yel-txt)" },
  close: { text: "Lùi ra sau một chút", icon: ZoomOut, bg: "var(--yel)", fg: "var(--yel-txt)" },
  far: { text: "Tiến lại gần hơn", icon: ZoomIn, bg: "var(--yel)", fg: "var(--yel-txt)" },
  ok: { text: "Tốt rồi", icon: Hand, bg: "var(--grn-soft)", fg: "var(--grn-txt)" },
};

function HintChip({ hint, hands }: { hint: Hint; hands: number }) {
  const h = HINTS[hint];
  return (
    <Pill bg={h.bg} fg={h.fg} icon={h.icon}>
      {hint === "ok" ? `${h.text} · thấy ${hands} bàn tay` : h.text}
    </Pill>
  );
}
