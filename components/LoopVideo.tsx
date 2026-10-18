"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { sampleUrl } from "@/lib/theme";
import { useProfile } from "@/lib/profile";

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
  allowScrubber = true,
}: {
  word: string;
  className?: string;
  style?: CSSProperties;
  label?: string;
  slow?: boolean;
  allowSpeedToggle?: boolean;
  allowScrubber?: boolean;
}) {
  const { profile } = useProfile();
  const ref = useRef<HTMLVideoElement>(null);
  const [broken, setBroken] = useState(false);
  const [rate, setRate] = useState(slow ? 0.5 : 1);
  const [duration, setDuration] = useState(0);
  const [currTime, setCurrTime] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [showScrubber, setShowScrubber] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

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
        if (e.isIntersecting) {
          if (!scrubbing && !isPaused) v.play().catch(() => {});
        } else {
          v.pause();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(v);
    return () => io.disconnect();
  }, [word, scrubbing, isPaused]);

  const toggleSpeed = (e: React.MouseEvent) => {
    if (!allowSpeedToggle) return;
    e.stopPropagation();
    setRate((r) => (r === 1 ? 0.5 : 1));
  };

  const handleTimeUpdate = () => {
    const v = ref.current;
    if (v && !scrubbing) {
      setCurrTime(v.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const v = ref.current;
    if (v) {
      setDuration(v.duration || 0);
      setCurrTime(v.currentTime);
      v.playbackRate = rate;
      (v as unknown as { preservesPitch?: boolean }).preservesPitch = true;
    }
  };

  const onScrub = (val: number) => {
    const v = ref.current;
    if (!v) return;
    setCurrTime(val);
    v.currentTime = val;
  };

  const stepFrame = (delta: number) => {
    const v = ref.current;
    if (!v) return;
    v.pause();
    setIsPaused(true);
    const nextT = Math.max(0, Math.min(duration || 3, v.currentTime + delta));
    v.currentTime = nextT;
    setCurrTime(nextT);
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
            loop={!scrubbing && !isPaused}
            playsInline
            preload="metadata"
            style={{ transform: profile.leftHanded ? "scaleX(-1)" : undefined, transition: "transform 0.2s ease" }}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onLoadedData={() => {
              const v = ref.current;
              if (v) {
                v.playbackRate = rate;
                (v as unknown as { preservesPitch?: boolean }).preservesPitch = true;
              }
            }}
            onClick={() => {
              if (allowScrubber) {
                setShowScrubber((s) => !s);
              } else {
                toggleSpeed({ stopPropagation: () => {} } as React.MouseEvent);
              }
            }}
            onError={() => setBroken(true)}
            aria-label={label ?? `Video mẫu ký hiệu “${word}”`}
          />

          {/* Nút bật/tắt tốc độ hoặc mở thanh tua frame */}
          <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 6, zIndex: 3 }}>
            {allowScrubber && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowScrubber((s) => !s);
                }}
                style={{
                  background: showScrubber ? "var(--brand)" : "rgba(0,0,0,0.6)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 16,
                  fontSize: 12,
                  fontWeight: 700,
                  minWidth: 44,
                  minHeight: 44,
                  padding: "0 10px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                aria-label="Tua từng frame cử chỉ"
                title="Tua từng khung hình (Scrubber)"
              >
                ⏱️ Tua
              </button>
            )}
            {allowSpeedToggle && (
              <button
                type="button"
                onClick={toggleSpeed}
                style={{
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
                }}
                aria-label="Đổi tốc độ video mẫu"
                title="Chạm để đổi tốc độ phát (1x / 0.5x)"
              >
                {rate === 0.5 ? "🐢 0.5x" : "1x"}
              </button>
            )}
          </div>

          {/* Thanh tua chậm từng frame (Lingvano Frame-by-Frame Scrubber) */}
          {showScrubber && (
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
                padding: "16px 12px 8px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                zIndex: 4,
                color: "#fff",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    border: "none",
                    color: "#fff",
                    borderRadius: 12,
                    minWidth: 44,
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                  onClick={() => {
                    const v = ref.current;
                    if (!v) return;
                    if (isPaused) {
                      v.play().catch(() => {});
                      setIsPaused(false);
                    } else {
                      v.pause();
                      setIsPaused(true);
                    }
                  }}
                  aria-label={isPaused ? "Phát tiếp" : "Tạm dừng"}
                >
                  {isPaused ? "▶" : "⏸"}
                </button>

                <button
                  type="button"
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    border: "none",
                    color: "#fff",
                    borderRadius: 12,
                    minWidth: 44,
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                  onClick={() => stepFrame(-0.06)}
                  aria-label="Lùi 1 frame"
                  title="Lùi 1 khung hình"
                >
                  -1
                </button>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <input
                    type="range"
                    min={0}
                    max={duration || 3}
                    step={0.03}
                    value={currTime}
                    onMouseDown={() => {
                      setScrubbing(true);
                      ref.current?.pause();
                    }}
                    onTouchStart={() => {
                      setScrubbing(true);
                      ref.current?.pause();
                    }}
                    onChange={(e) => onScrub(parseFloat(e.target.value))}
                    onMouseUp={() => {
                      setScrubbing(false);
                      if (!isPaused) ref.current?.play().catch(() => {});
                    }}
                    onTouchEnd={() => {
                      setScrubbing(false);
                      if (!isPaused) ref.current?.play().catch(() => {});
                    }}
                    style={{ width: "100%", height: 28, cursor: "pointer", accentColor: "var(--brand)" }}
                    aria-label="Tua vị trí video"
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.85, fontWeight: 600 }}>
                    <span>{currTime.toFixed(2)}s</span>
                    <span>{(duration || 3).toFixed(2)}s</span>
                  </div>
                </div>

                <button
                  type="button"
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    border: "none",
                    color: "#fff",
                    borderRadius: 12,
                    minWidth: 44,
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                  onClick={() => stepFrame(0.06)}
                  aria-label="Tiến 1 frame"
                  title="Tiến 1 khung hình"
                >
                  +1
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
