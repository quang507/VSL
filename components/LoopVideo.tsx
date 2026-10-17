"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { sampleUrl } from "@/lib/theme";

/**
 * Video ký hiệu thật, tắt tiếng, lặp lại. Chỉ chạy khi đang nằm trong màn hình
 * (đỡ tốn pin khi có nhiều video), và đứng yên ở khung đầu nếu người dùng tắt chuyển động.
 */
export default function LoopVideo({
  word,
  className,
  style,
  label,
  slow = false,
  allowSpeedToggle = false,
}: {
  word: string;
  className?: string;
  style?: CSSProperties;
  label?: string;
  slow?: boolean;
  allowSpeedToggle?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [broken, setBroken] = useState(false);
  const [rate, setRate] = useState(slow ? 0.5 : 1);

  useEffect(() => {
    setRate(slow ? 0.5 : 1);
  }, [slow]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.playbackRate = rate;
    (v as unknown as { preservesPitch?: boolean }).preservesPitch = true;
  }, [rate]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (still) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.25 }
    );
    io.observe(v);
    return () => io.disconnect();
  }, [word]);

  const toggleSpeed = (e: React.MouseEvent) => {
    if (!allowSpeedToggle) return;
    e.stopPropagation();
    setRate((r) => (r === 1 ? 0.5 : 1));
  };

  return (
    <div className={`vid ${className ?? ""}`} style={{ ...style, position: "relative" }}>
      {!broken && (
        <>
          <video
            ref={ref}
            key={word}
            src={`${sampleUrl(word)}#t=0.4`}
            muted
            loop
            playsInline
            preload="metadata"
            onLoadedData={() => {
              const v = ref.current;
              if (v) {
                v.playbackRate = rate;
                (v as unknown as { preservesPitch?: boolean }).preservesPitch = true;
              }
            }}
            onClick={toggleSpeed}
            onError={() => setBroken(true)}
            aria-label={label ?? `Video mẫu ký hiệu “${word}”`}
          />
          {allowSpeedToggle && (
            <button
              type="button"
              onClick={toggleSpeed}
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                background: rate === 0.5 ? "var(--brand)" : "rgba(0,0,0,0.6)",
                color: "#fff",
                border: "none",
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 700,
                minWidth: 44,
                minHeight: 44,
                padding: "4px 8px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 2,
              }}
              aria-label="Đổi tốc độ video mẫu"
              title="Chạm để đổi tốc độ phát (1x / 0.5x)"
            >
              {rate === 0.5 ? "🐢 0.5x" : "1x"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
