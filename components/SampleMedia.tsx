"use client";

import { asset } from "@/lib/base";
import { useEffect, useRef, useState } from "react";
import { Gauge, Repeat, FlipHorizontal } from "lucide-react";
import { sampleUrl } from "@/lib/theme";
import { useProfile } from "@/lib/profile";

/** Video mẫu của một từ (public/samples/<từ>.mp4). Không có file thì hiện ảnh minh hoạ. */
export default function SampleMedia({ word, slow = false, aspect = "1 / 1", controls = true }: { word: string; slow?: boolean; aspect?: string; controls?: boolean }) {
  const { profile } = useProfile();
  const [ok, setOk] = useState(true);
  const [rate, setRate] = useState(slow ? 0.5 : 1);
  const [flipped, setFlipped] = useState(profile.leftHanded);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setFlipped(profile.leftHanded);
  }, [profile.leftHanded]);

  useEffect(() => setOk(true), [word]);
  // Lỗi có thể xảy ra trước khi React gắn onError (lúc hydrate) → kiểm tra lại
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (v.error) setOk(false);
    const onErr = () => setOk(false);
    v.addEventListener("error", onErr);
    return () => v.removeEventListener("error", onErr);
  }, [word, ok]);
  useEffect(() => {
    if (ref.current) {
      ref.current.playbackRate = rate;
      (ref.current as unknown as { preservesPitch?: boolean }).preservesPitch = true;
    }
  }, [rate, ok, word]);

  return (
    <div className="media" style={{ aspectRatio: aspect }}>
      {ok ? (
        <video
          key={word}
          ref={ref}
          src={sampleUrl(word)}
          autoPlay
          loop
          muted
          playsInline
          style={{ transform: flipped ? "scaleX(-1)" : undefined, transition: "transform 0.2s ease" }}
          onLoadedData={() => {
            const v = ref.current;
            if (!v) return;
            v.playbackRate = rate;
            (v as unknown as { preservesPitch?: boolean }).preservesPitch = true;
            v.play().catch(() => {});
          }}
          onClick={() => (ref.current?.paused ? ref.current.play().catch(() => {}) : ref.current?.pause())}
          onError={() => setOk(false)}
          aria-label={`Video mẫu ký hiệu ${word}${flipped ? " (đã lật tay trái)" : ""}`}
        />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="photo" src={asset("/img/signer.png")} alt="" />
          <div style={{ position: "absolute", left: 12, right: 12, bottom: 12, background: "rgba(255,255,255,.92)", borderRadius: 14, padding: "10px 12px", fontWeight: 700, fontSize: 14 }}>
            Chưa có video mẫu cho “{word}”
          </div>
        </>
      )}
      {ok && controls && (
        <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", zIndex: 2 }}>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="pill"
              onClick={() => setRate(rate === 1 ? 0.5 : 1)}
              style={{ background: rate === 0.5 ? "var(--brand)" : "rgba(0,0,0,.6)", color: "#fff", border: "none", minHeight: 44, padding: "0 12px", fontWeight: 700 }}
              aria-label="Đổi tốc độ video"
            >
              🐢 {rate === 1 ? "Tốc độ 1x" : "Chậm 0.5x"}
            </button>
            <button
              type="button"
              className="pill"
              onClick={() => setFlipped(!flipped)}
              style={{ background: flipped ? "var(--brand)" : "rgba(0,0,0,.6)", color: "#fff", border: "none", minHeight: 44, padding: "0 12px", fontWeight: 600 }}
              aria-label="Lật video cho người thuận tay trái"
              title="Lật video để dễ học theo nếu bạn thuận tay trái"
            >
              <FlipHorizontal size={16} aria-hidden /> {flipped ? "Đã lật tay trái" : "Tay trái"}
            </button>
          </div>
          <span className="pill" style={{ background: "rgba(0,0,0,.6)", color: "#fff", minHeight: 44, padding: "0 12px" }}>
            <Repeat size={16} aria-hidden /> Lặp lại
          </span>
        </div>
      )}
    </div>
  );
}
