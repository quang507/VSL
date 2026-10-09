"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, Gauge, WifiOff } from "lucide-react";
import { Btn, TopBar } from "@/components/ui";
import { useProfile } from "@/lib/profile";
import { useLabels } from "@/lib/useLabels";
import { practiceUrl } from "@/lib/nav";
import { QIPEDC_SOURCE, VARIANT_NAME, fold, preferredVariant, useQipedc, videoUrl, wordUrl } from "@/lib/qipedc";
import Link from "next/link";

function WordInner() {
  const w = useSearchParams().get("w") ?? "";
  const { entries, loading } = useQipedc();
  const { labels } = useLabels();
  const { profile } = useProfile();
  const entry = useMemo(() => entries.find((e) => e.w === w), [entries, w]);
  const [variant, setVariant] = useState<string>("");
  const [slow, setSlow] = useState(profile.slowVideo);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (entry) setVariant(preferredVariant(entry, profile.region));
  }, [entry, profile.region]);
  useEffect(() => setFailed(false), [variant]);
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = slow ? 0.5 : 1;
  }, [slow, variant]);

  // Từ này có trong bộ 100 từ chấm bằng camera không (so không phân biệt hoa thường)
  const trained = useMemo(() => labels.find((l) => fold(l) === fold(w)), [labels, w]);
  // Gợi ý: các từ bắt đầu giống
  const related = useMemo(() => {
    if (!entry) return [];
    // cùng tiếng đầu (giữ dấu: "nhân" không lẫn với "nhãn", "nhăn")
    const head = w.toLowerCase().split(" ")[0];
    return entries.filter((e) => e.w !== w && e.w.toLowerCase().split(" ")[0] === head).slice(0, 8);
  }, [entries, entry, w]);

  if (loading) return <main className="app"><TopBar back="/tu-dien" /><div className="skeleton" style={{ height: 240 }} /></main>;
  if (!entry)
    return (
      <main className="app">
        <TopBar back="/tu-dien" title="Từ điển" />
        <div className="card">Không tìm thấy “{w}”.</div>
      </main>
    );

  const variants = ["B", "T", "N", "_"].filter((r) => entry.v[r as keyof typeof entry.v]);
  const id = entry.v[variant as keyof typeof entry.v];

  return (
    <main className="app">
      <TopBar back="/tu-dien" />
      <header className="col col--tight">
        {entry.t && <span className="eyebrow">{entry.t}</span>}
        <h1 className="d4">{entry.w}</h1>
      </header>

      <div className="vid" style={{ aspectRatio: "16 / 9", background: "#111", maxWidth: 720 }}>
        {id && !failed ? (
          <video
            key={id}
            ref={ref}
            src={videoUrl(id)}
            autoPlay
            loop
            muted
            playsInline
            onLoadedData={() => {
              if (ref.current) ref.current.playbackRate = slow ? 0.5 : 1;
            }}
            onClick={() => (ref.current?.paused ? ref.current.play().catch(() => {}) : ref.current?.pause())}
            onError={() => setFailed(true)}
            aria-label={`Video ký hiệu “${entry.w}”, ${VARIANT_NAME[variant]}`}
          />
        ) : (
          <div className="col" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", color: "#fff", textAlign: "center", padding: 16 }}>
            <WifiOff size={28} aria-hidden />
            <span className="bb">Không tải được video. Cần có mạng để xem từ điển Bộ GD&ĐT.</span>
          </div>
        )}
        <button
          type="button"
          className="pill"
          onClick={() => setSlow(!slow)}
          style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,.6)", color: "#fff", border: "none", minHeight: 36 }}
          aria-label="Đổi tốc độ video"
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

      {entry.d && (
        <section className="col col--tight">
          <span className="eyebrow">Nghĩa</span>
          <p className="bm" style={{ margin: 0, color: "var(--txt)", fontSize: 17 }}>
            {entry.d}
          </p>
        </section>
      )}

      {trained ? (
        <Btn href={practiceUrl(trained)} icon={Camera}>
          Luyện với camera
        </Btn>
      ) : (
        <>
          <Btn href={`/tu-dien/luyen?w=${encodeURIComponent(entry.w)}`} level="tertiary" icon={Camera}>
            Tập theo mẫu với camera
          </Btn>
          <p className="sm" style={{ margin: 0 }}>
            Từ này chưa chấm điểm được. Camera chỉ làm gương để bạn tự so với video.
          </p>
        </>
      )}

      {related.length > 0 && (
        <section className="col" style={{ gap: 8 }}>
          <span className="eyebrow">Từ liên quan</span>
          <div className="row wrap" style={{ gap: 8 }}>
            {related.map((e) => (
              <Link key={e.w} href={wordUrl(e.w)} className="chip" style={{ display: "inline-flex", alignItems: "center" }}>
                {e.w}
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="sm" style={{ margin: 0 }}>
        Nguồn video: {QIPEDC_SOURCE}.
      </p>
    </main>
  );
}

export default function WordPage() {
  return (
    <Suspense fallback={<main className="app">Đang tải…</main>}>
      <WordInner />
    </Suspense>
  );
}
