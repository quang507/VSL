"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Btn, Pill } from "@/components/ui";
import { useLabels } from "@/lib/useLabels";
import { useProgress } from "@/lib/useProgress";
import { buildLessons } from "@/lib/lessons";
import { isLearned } from "@/lib/progress";
import { practiceUrl } from "@/lib/nav";
import { sampleUrl } from "@/lib/theme";

// Tìm không dấu: "benh vien" vẫn ra "Bệnh viện"
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();

export default function Dictionary() {
  const { labels, loading } = useLabels();
  const [progress] = useProgress();
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState<string>("all");
  const lessons = useMemo(() => buildLessons(labels), [labels]);
  const topicOf = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of lessons) for (const w of l.words) m[w] = l.title;
    return m;
  }, [lessons]);

  const wordOfDay = useMemo(() => {
    if (!labels.length) return "";
    const d = new Date();
    return labels[(d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate()) % labels.length];
  }, [labels]);

  const list = useMemo(() => {
    const base = topic === "all" ? labels : lessons.find((l) => l.id === topic)?.words ?? [];
    const f = fold(q);
    return f ? base.filter((w) => fold(w).includes(f)) : base;
  }, [labels, lessons, topic, q]);

  return (
    <main className="app app--nav" style={{ gap: 18 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="cloud" src="/img/cloud.png" alt="" />
      <div className="col col--tight" style={{ position: "relative" }}>
        <span className="bm">{labels.length} ký hiệu · xem mẫu và luyện camera</span>
        <h1 className="h1">Từ điển VSL</h1>
      </div>

      <label className="input" style={{ boxShadow: "var(--shadow-soft)", border: "none" }}>
        <Search size={22} color="var(--acc)" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm từ, gõ có dấu hoặc không dấu" aria-label="Tìm từ" />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Xoá tìm kiếm" style={{ border: "none", background: "none", minWidth: 44, minHeight: 44 }}>
            <X size={20} aria-hidden />
          </button>
        )}
      </label>

      {!q && wordOfDay && (
        <section className="tile t-blu" style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <div className="col grow" style={{ gap: 6 }}>
            <Pill bg="var(--yel)" fg="var(--yel-txt)" icon={Sparkles}>
              Từ của ngày
            </Pill>
            <span className="h2">{wordOfDay}</span>
            <span className="sm">{topicOf[wordOfDay]}</span>
            <div style={{ marginTop: 4 }}>
              <Btn href={practiceUrl(wordOfDay)} size="sm" block={false}>
                Học ngay
              </Btn>
            </div>
          </div>
          <video src={sampleUrl(wordOfDay)} autoPlay loop muted playsInline style={{ width: 120, height: 150, objectFit: "cover", borderRadius: 18, background: "#fff", border: "4px solid #fff", transform: "rotate(3deg)" }} aria-hidden />
        </section>
      )}

      <div className="chips" role="group" aria-label="Chủ đề">
        <button type="button" className="chip" aria-pressed={topic === "all"} onClick={() => setTopic("all")}>
          Tất cả
        </button>
        {lessons.map((l) => (
          <button key={l.id} type="button" className="chip" aria-pressed={topic === l.id} onClick={() => setTopic(l.id)}>
            {l.title}
          </button>
        ))}
      </div>

      <span className="sm">{q ? `${list.length} kết quả cho “${q}”` : `${list.length} từ`}</span>

      {loading ? (
        <div className="skeleton" style={{ height: 300, borderRadius: 24 }} />
      ) : list.length === 0 ? (
        <div className="card center" style={{ alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/mascot_sad.png" alt="" style={{ width: 140 }} />
          <span className="h4">Chưa có từ “{q}”</span>
          <span className="bm">Từ điển hiện có {labels.length} ký hiệu. Thử từ khác hoặc chọn chủ đề.</span>
        </div>
      ) : (
        <div className="card card--list">
          {list.map((w) => {
            const learned = isLearned(progress, w);
            return (
              <Link key={w} href={practiceUrl(w)} className="list-row" style={{ minHeight: 64 }}>
                <span className="col col--tight grow">
                  <span className="bb">{w}</span>
                  <span className="sm">{topicOf[w]}</span>
                </span>
                {learned && <CheckCircle2 size={22} color="var(--grn)" aria-label="Đã thuộc" />}
                <ChevronRight size={20} color="var(--txt3)" aria-hidden />
              </Link>
            );
          })}
        </div>
      )}
      <p className="sm" style={{ margin: 0 }}>
        Video mẫu: ViSignLanguage-Video (PTIT AI Challenge), giấy phép CC-BY-4.0.
      </p>
      <BottomNav />
    </main>
  );
}
