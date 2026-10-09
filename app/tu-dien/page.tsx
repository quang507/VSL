"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, CheckCircle2, ChevronRight, Play } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import LoopVideo from "@/components/LoopVideo";
import { Btn } from "@/components/ui";
import { useLabels } from "@/lib/useLabels";
import { useProgress } from "@/lib/useProgress";
import { buildLessons } from "@/lib/lessons";
import { isLearned } from "@/lib/progress";
import { practiceUrl } from "@/lib/nav";

// Tìm không dấu: "benh vien" vẫn ra "Bệnh viện"
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();

// Chữ cái đầu theo bảng chữ Việt: bỏ dấu thanh, giữ Ă Â Đ Ê Ô Ơ Ư
const initial = (w: string) =>
  w.normalize("NFD").replace(/[̣̀́̃̉]/g, "").normalize("NFC").charAt(0).toUpperCase();

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
    return (f ? base.filter((w) => fold(w).includes(f)) : base).slice().sort((a, b) => a.localeCompare(b, "vi"));
  }, [labels, lessons, topic, q]);

  const groups = useMemo(() => {
    const g: [string, string[]][] = [];
    for (const w of list) {
      const k = initial(w);
      if (g.length && g[g.length - 1][0] === k) g[g.length - 1][1].push(w);
      else g.push([k, [w]]);
    }
    return g;
  }, [list]);

  return (
    <main className="app app--nav">
      <header className="col col--tight">
        <span className="bm num">{labels.length} ký hiệu, mỗi từ có video mẫu</span>
        <h1 className="h1">Từ điển</h1>
      </header>

      <label className="input">
        <Search size={22} color="var(--txt2)" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm từ, gõ có dấu hoặc không dấu" aria-label="Tìm từ" />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Xoá tìm kiếm" style={{ border: "none", background: "none", minWidth: 44, minHeight: 44 }}>
            <X size={20} aria-hidden />
          </button>
        )}
      </label>

      <div className="split">
        <div className="col" style={{ gap: 16 }}>
          {!q && wordOfDay && (
            <section className="card" style={{ padding: 12, gap: 12 }}>
              <LoopVideo word={wordOfDay} style={{ aspectRatio: "1 / 1" }} />
              <div className="row" style={{ padding: "0 4px 4px", alignItems: "flex-end" }}>
                <div className="col col--tight grow">
                  <span className="eyebrow">Từ của ngày</span>
                  <span className="h2">
                    <span className="mark">{wordOfDay}</span>
                  </span>
                  <span className="sm">{topicOf[wordOfDay]}</span>
                </div>
                <Btn href={practiceUrl(wordOfDay)} size="md" block={false} icon={Play}>
                  Luyện
                </Btn>
              </div>
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
        </div>

        <section className="col" style={{ gap: 8 }} aria-label="Danh sách từ">
          <span className="sm" aria-live="polite">
            {q ? `${list.length} kết quả cho “${q}”` : `${list.length} từ`}
          </span>
          {loading ? (
            <div className="skeleton" style={{ height: 300 }} />
          ) : list.length === 0 ? (
            <div className="card" style={{ gap: 6 }}>
              <span className="h4">Chưa có “{q}”</span>
              <span className="bm">Từ điển hiện có {labels.length} ký hiệu. Thử gõ không dấu, hoặc chọn một chủ đề.</span>
            </div>
          ) : (
            groups.map(([letter, words]) => (
              <div key={letter}>
                <div className="letter">{letter}</div>
                <div className="rows">
                  {words.map((w) => (
                    <Link key={w} href={practiceUrl(w)}>
                      <span className="col col--tight grow">
                        <span className="bb">{w}</span>
                        <span className="sm">{topicOf[w]}</span>
                      </span>
                      {isLearned(progress, w) && <CheckCircle2 size={22} color="var(--grn)" aria-label="Đã thuộc" />}
                      <ChevronRight size={20} color="var(--txt3)" aria-hidden />
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
          <p className="sm" style={{ margin: "8px 0 0" }}>
            Video mẫu: ViSignLanguage-Video (PTIT AI Challenge), giấy phép CC-BY-4.0.
          </p>
        </section>
      </div>
      <BottomNav />
    </main>
  );
}
