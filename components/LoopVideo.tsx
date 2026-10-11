"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { sampleUrl } from "@/lib/theme";

/**
 * Video ký hiệu thật, tắt tiếng, lặp lại. Chỉ chạy khi đang nằm trong màn hình
 * (đỡ tốn pin khi có nhiều video), và đứng yên ở khung đầu nếu người dùng tắt chuyển động.
 */
export default function LoopVideo({ word, className, style, label }: { word: string; className?: string; style?: CSSProperties; label?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [broken, setBroken] = useState(false);

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

  return (
    <div className={`vid ${className ?? ""}`} style={style}>
      {!broken && (
        <video
          ref={ref}
          key={word}
          src={`${sampleUrl(word)}#t=0.4`}
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setBroken(true)}
          aria-label={label ?? `Video mẫu ký hiệu “${word}”`}
        />
      )}
    </div>
  );
}
