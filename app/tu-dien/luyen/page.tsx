"use client";

import CameraError from "@/components/CameraError";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Gauge, Info } from "lucide-react";
import CameraStage from "@/components/CameraStage";
import { TopBar } from "@/components/ui";
import { useSignPractice } from "@/lib/useSignPractice";
import { useProfile } from "@/lib/profile";
import { VARIANT_NAME, preferredVariant, useQipedc, variantsOf, videoUrl, wordUrl } from "@/lib/qipedc";

/**
 * Tập theo mẫu cho từ trong từ điển Bộ GD&ĐT: video mẫu cạnh camera (gương) để tự so.
 * KHÔNG chấm điểm: đã đo, so lần ký với video từ điển chỉ nhận đúng ~55% và khen nhầm ~18%
 * (training/qipedc/report_cross.json), chưa đủ tin cậy để báo đúng/sai.
 */
function Inner() {
  const params = useSearchParams();
  const w = params.get("w") ?? "";
  const si = Number(params.get("s")) || 0;
  const { entries } = useQipedc();
  const { profile } = useProfile();
  const entry = useMemo(() => entries.find((e) => e.w === w), [entries, w]);
  const sense = entry?.s[Math.min(si, entry.s.length - 1)];
  const [variant, setVariant] = useState("");
  const [slow, setSlow] = useState(true);
  const demo = useRef<HTMLVideoElement>(null);
  const { videoRef, canvasRef, phase, count, handsVisible, hint, cameraError } = useSignPractice();

  useEffect(() => {
    if (sense) setVariant(preferredVariant(sense, profile.region));
  }, [sense, profile.region]);
  useEffect(() => {
    if (demo.current) demo.current.playbackRate = slow ? 0.5 : 1;
  }, [slow, variant]);

  const id = sense?.v[variant as keyof typeof sense.v];
  const variants = sense ? variantsOf(sense) : [];

  return (
    <main className="app" style={{ gap: 16 }}>
      <TopBar back={w ? wordUrl(w, si) : "/tu-dien"} title="Tập theo mẫu" />
      <h1 className="d4">{w}</h1>

      <div className="split">
        <div className="col" style={{ gap: 10 }}>
          <div className="vid" style={{ aspectRatio: "16 / 9", background: "#111" }}>
            {id && (
              <video
                key={id}
                ref={demo}
                src={videoUrl(id)}
                autoPlay
                loop
                muted
                playsInline
                onLoadedData={() => {
                  if (demo.current) demo.current.playbackRate = slow ? 0.5 : 1;
                }}
                aria-label={`Video mẫu “${w}”`}
              />
            )}
            <button
              type="button"
              className="pill"
              onClick={() => setSlow(!slow)}
              style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,.6)", color: "#fff", border: "none", minHeight: 44 }}
              aria-label="Đổi tốc độ video mẫu"
            >
              <Gauge size={16} aria-hidden /> {slow ? "Chậm 0.5x" : "Tốc độ 1x"}
            </button>
          </div>
          {variants.length > 1 && (
            <div className="seg" role="group" aria-label="Biến thể theo miền">
              {variants.map((r) => (
                <button key={r} type="button" aria-pressed={r === variant} onClick={() => setVariant(r)}>
                  {VARIANT_NAME[r]}
                </button>
              ))}
            </div>
          )}
        </div>
        <CameraStage videoRef={videoRef} canvasRef={canvasRef} phase={phase} count={count} handsVisible={handsVisible} hint={hint} error={!!cameraError} />
      </div>

      {cameraError && <CameraError note="Bạn vẫn xem được video mẫu." />}
      <div className="card card--row">
        <Info size={22} color="var(--txt2)" aria-hidden />
        <span className="bm">
          Camera như một tấm gương: làm theo video và tự so hình tay, hướng tay, chuyển động. Phần này không chấm điểm. App chỉ chấm được 100 từ trong mục Lộ trình.
        </span>
      </div>
    </main>
  );
}

export default function TemplatePracticePage() {
  return (
    <Suspense fallback={<main className="app">Đang tải…</main>}>
      <Inner />
    </Suspense>
  );
}
