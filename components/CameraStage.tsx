"use client";

import type { RefObject, ReactNode } from "react";
import { Hand, ScanFace, CameraOff } from "lucide-react";
import type { Phase } from "@/lib/useSignPractice";
import { Pill } from "./ui";

/** Khung camera dùng chung cho Luyện tập và Đố vui: video gương + khung xương tay + đếm ngược. */
export default function CameraStage({
  videoRef,
  canvasRef,
  phase,
  count,
  handsVisible,
  veil,
  error,
}: {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  phase: Phase;
  count: number;
  handsVisible: number;
  veil?: ReactNode;
  error?: boolean;
}) {
  return (
    <div className="cam">
      <video ref={videoRef} playsInline muted />
      <canvas ref={canvasRef} />
      <div className="cam-frame" aria-hidden />
      <div className="cam-chip">
        {handsVisible > 0 ? (
          <Pill bg="var(--grn-soft)" fg="var(--grn-txt)" icon={Hand}>
            Thấy {handsVisible} bàn tay
          </Pill>
        ) : (
          <Pill bg="rgba(255,255,255,.92)" fg="var(--txt)" icon={ScanFace}>
            Đưa tay vào khung
          </Pill>
        )}
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
      {veil && <div className="cam-veil">{veil}</div>}
    </div>
  );
}
