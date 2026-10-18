"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, Gauge, WifiOff, Volume2, Share2 } from "lucide-react";
import { Btn, TopBar } from "@/components/ui";
import { useProfile } from "@/lib/profile";
import { useLabels } from "@/lib/useLabels";
import { practiceUrl } from "@/lib/nav";
import { speakVietnamese } from "@/lib/feedback";
import { loadProgress, wordStrength } from "@/lib/progress";
import { QIPEDC_SOURCE, VARIANT_NAME, fold, preferredVariant, useQipedc, variantsOf, videoUrl, wordUrl } from "@/lib/qipedc";
import Link from "next/link";
import SaveBtn from "@/components/SaveBtn";

function WordInner() {
  const params = useSearchParams();
  const w = params.get("w") ?? "";
  const [si, setSi] = useState(Number(params.get("s")) || 0);
  const { entries, loading } = useQipedc();
  const { labels } = useLabels();
  const { profile } = useProfile();
  const entry = useMemo(() => entries.find((e) => e.w === w), [entries, w]);
  const sense = entry?.s[Math.min(si, entry.s.length - 1)];
  const [variant, setVariant] = useState<string>("");
  const [slow, setSlow] = useState(profile.slowVideo);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (sense) setVariant(preferredVariant(sense, profile.region));
  }, [sense, profile.region]);
  useEffect(() => {
    setFailed(false);
    setReady(false);
  }, [variant, si]);
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
  if (!entry || !sense)
    return (
      <main className="app">
        <TopBar back="/tu-dien" title="Từ điển" />
        <div className="card">Không tìm thấy “{w}”.</div>
      </main>
    );

  const variants = variantsOf(sense);
  const id = sense.v[variant as keyof typeof sense.v];

  const shareWord = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const shareData = {
      title: `Học ký hiệu: ${entry.w}`,
      text: `Cùng học từ ngôn ngữ ký hiệu “${entry.w}” với tôi nhé!`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert("Đã sao chép link từ để gửi cho người thân!");
      } catch {}
    }
  };

  return (
    <main className="app">
      <TopBar
        back="/tu-dien"
        right={
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className="icon-circle"
              style={{ width: 44, height: 44, border: "none", background: "var(--surface)", boxShadow: "var(--shadow-tile)", color: "var(--txt)" }}
              onClick={shareWord}
              aria-label="Chia sẻ từ này cho người thân"
            >
              <Share2 size={20} aria-hidden />
            </button>
            <SaveBtn word={entry.w} />
          </div>
        }
      />
      <header className="col col--tight">
        {sense.t && <span className="eyebrow">{sense.t}</span>}
        <div className="row" style={{ gap: 12, alignItems: "center" }}>
          <h1 className="d4" style={{ margin: 0 }}>{entry.w}</h1>
          <button
            type="button"
            className="icon-circle"
            style={{ width: 44, height: 44, border: "none", background: "var(--brand-soft)", color: "var(--acc)", flex: "none" }}
            onClick={() => speakVietnamese(entry.w)}
            aria-label={`Nghe phát âm từ “${entry.w}”`}
          >
            <Volume2 size={22} aria-hidden />
          </button>
        </div>
        {/* Sức mạnh trí nhớ của từ (Lingvano Word Memory Strength) */}
        {(() => {
          const prog = loadProgress();
          const stat = prog.words[entry.w];
          const strength = wordStrength(stat);
          if (!stat || stat.correct <= 0) return null;
          const color = strength >= 70 ? "var(--pos)" : strength >= 40 ? "var(--warn)" : "var(--neg)";
          return (
            <div className="row" style={{ gap: 8, alignItems: "center", marginTop: 4 }}>
              <span className="sm num" style={{ fontWeight: 700, color }}>
                Độ nhớ: {strength}%
              </span>
              <div style={{ width: 100, height: 6, background: "var(--line)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${strength}%`, height: "100%", background: color, borderRadius: 4 }} />
              </div>
              <span className="sm" style={{ color: "var(--txt2)" }}>
                {strength >= 70 ? "Nhớ chắc" : strength >= 40 ? "Nên ôn lại" : "Sắp quên!"}
              </span>
            </div>
          );
        })()}
      </header>

      {entry.s.length > 1 && (
        <div className="seg" role="group" aria-label="Nghĩa của từ">
          {entry.s.map((x, i) => (
            <button key={i} type="button" aria-pressed={i === si} onClick={() => setSi(i)}>
              Nghĩa {i + 1}
              {x.t ? ` · ${x.t}` : ""}
            </button>
          ))}
        </div>
      )}

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
            style={{ transform: profile.leftHanded ? "scaleX(-1)" : undefined, transition: "transform 0.2s ease" }}
            onLoadedData={() => {
              setReady(true);
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
            <button type="button" className="btn btn--tertiary btn--md" onClick={() => setFailed(false)}>
              Thử lại
            </button>
          </div>
        )}
        {id && !failed && !ready && (
          <div className="col" role="status" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", color: "#fff", background: "#111" }}>
            <span className="bb">Đang tải video…</span>
          </div>
        )}
        <button
          type="button"
          className="pill"
          onClick={() => setSlow(!slow)}
          style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,.6)", color: "#fff", border: "none", minHeight: 44 }}
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

      {sense.d && (
        <section className="col col--tight">
          <span className="eyebrow">Nghĩa</span>
          <p className="bm" style={{ margin: 0, color: "var(--txt)", fontSize: 17 }}>
            {sense.d}
          </p>
        </section>
      )}

      {trained ? (
        <Btn href={practiceUrl(trained)} icon={Camera}>
          Luyện với camera
        </Btn>
      ) : (
        <>
          <Btn href={`/tu-dien/luyen?w=${encodeURIComponent(entry.w)}${si ? `&s=${si}` : ""}`} level="tertiary" icon={Camera}>
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
