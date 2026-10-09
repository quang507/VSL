"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, CheckCircle2, ChevronRight, Play, Camera } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import LoopVideo from "@/components/LoopVideo";
import { Btn, Segmented } from "@/components/ui";
import { useLabels } from "@/lib/useLabels";
import { useProgress } from "@/lib/useProgress";
import { buildLessons } from "@/lib/lessons";
import { isLearned } from "@/lib/progress";
import { practiceUrl } from "@/lib/nav";
import { QIPEDC_SOURCE, fold, useQipedc, wordUrl, type QEntry } from "@/lib/qipedc";

// Chữ cái đầu theo bảng chữ Việt: bỏ dấu thanh, giữ Ă Â Đ Ê Ô Ơ Ư
const initial = (w: string) =>
  w.normalize("NFD").replace(/[̣̀́̃̉]/g, "").normalize("NFC").charAt(0).toUpperCase();

const ALPHABET = "A Ă Â B C D Đ E Ê G H I K L M N O Ô Ơ P Q R S T U Ư V X Y".split(" ");
type Tab = "cam" | "all";

function groupByLetter(words: string[]) {
  const g: [string, string[]][] = [];
  for (const w of words) {
    const k = initial(w);
    if (g.length && g[g.length - 1][0] === k) g[g.length - 1][1].push(w);
    else g.push([k, [w]]);
  }
  return g;
}

function QRow({ e, trained }: { e: QEntry; trained: boolean }) {
  const n = Object.keys(e.v).length;
  return (
    <Link href={wordUrl(e.w)}>
      <span className="col col--tight grow" style={{ minWidth: 0 }}>
        <span className="bb">{e.w}</span>
        <span className="sm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {[e.t, n > 1 ? `${n} miền` : "", e.d].filter(Boolean).join(" · ")}
        </span>
      </span>
      {trained && <Camera size={20} color="var(--acc)" aria-label="Chấm được bằng camera" />}
      <ChevronRight size={20} color="var(--txt3)" aria-hidden />
    </Link>
  );
}

export default function Dictionary() {
  const { labels, loading } = useLabels();
  const { entries, loading: qLoading } = useQipedc();
  const [progress] = useProgress();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("cam");
  const [topic, setTopic] = useState<string>("all");
  const [letter, setLetter] = useState("A");
  const lessons = useMemo(() => buildLessons(labels), [labels]);
  const topicOf = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of lessons) for (const w of l.words) m[w] = l.title;
    return m;
  }, [lessons]);
  const trainedSet = useMemo(() => new Set(labels.map(fold)), [labels]);

  // Nhớ tab đang xem
  useEffect(() => {
    try {
      const t = localStorage.getItem("vsl-dict-tab");
      if (t === "all" || t === "cam") setTab(t);
    } catch {}
  }, []);
  const pickTab = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem("vsl-dict-tab", t);
    } catch {}
  };

  const wordOfDay = useMemo(() => {
    if (!labels.length) return "";
    const d = new Date();
    return labels[(d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate()) % labels.length];
  }, [labels]);

  const f = fold(q);
  const camList = useMemo(() => {
    const base = topic === "all" ? labels : lessons.find((l) => l.id === topic)?.words ?? [];
    return (f ? base.filter((w) => fold(w).includes(f)) : base).slice().sort((a, b) => a.localeCompare(b, "vi"));
  }, [labels, lessons, topic, f]);
  const groups = useMemo(() => groupByLetter(camList), [camList]);

  // Kết quả tìm trong từ điển Bộ GD&ĐT: khớp đầu từ trước, rồi khớp giữa
  const qHits = useMemo(() => {
    if (!f) return [];
    const starts: QEntry[] = [], inside: QEntry[] = [];
    for (const e of entries) {
      const k = fold(e.w);
      if (k.startsWith(f)) starts.push(e);
      else if (k.includes(f)) inside.push(e);
    }
    return [...starts, ...inside];
  }, [entries, f]);

  const words = useMemo(() => entries.filter((e) => e.k === 0), [entries]);
  const letters = useMemo(() => {
    const have = new Set(words.map((e) => initial(e.w)));
    return ALPHABET.filter((l) => have.has(l));
  }, [words]);
  const byLetter = useMemo(
    () => (letter === "#" ? entries.filter((e) => e.k !== 0) : words.filter((e) => initial(e.w) === letter)).sort((a, b) => a.w.localeCompare(b.w, "vi")),
    [entries, words, letter]
  );

  return (
    <main className="app app--nav">
      <header className="col col--tight">
        <span className="bm num">{entries.length ? `${entries.length.toLocaleString("vi")} từ có video · ${labels.length} từ chấm bằng camera` : `${labels.length} ký hiệu, mỗi từ có video mẫu`}</span>
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

      {q ? (
        /* ---------- Kết quả tìm: cả hai nguồn ---------- */
        <section className="col" style={{ gap: 16 }} aria-live="polite">
          {camList.length > 0 && (
            <div className="col" style={{ gap: 8 }}>
              <span className="eyebrow">Luyện được với camera · {camList.length}</span>
              <div className="rows">
                {camList.map((w) => (
                  <Link key={w} href={practiceUrl(w)}>
                    <span className="col col--tight grow">
                      <span className="bb">{w}</span>
                      <span className="sm">{topicOf[w]}</span>
                    </span>
                    {isLearned(progress, w) ? <CheckCircle2 size={22} color="var(--grn)" aria-label="Đã thuộc" /> : <Camera size={20} color="var(--acc)" aria-hidden />}
                    <ChevronRight size={20} color="var(--txt3)" aria-hidden />
                  </Link>
                ))}
              </div>
            </div>
          )}
          {(qLoading || qHits.length > 0 || camList.length === 0) && (
          <div className="col" style={{ gap: 8 }}>
            <span className="eyebrow">Từ điển Bộ GD&ĐT · {qLoading ? "…" : qHits.length}</span>
            {qHits.length > 0 ? (
              <div className="rows">
                {qHits.slice(0, 60).map((e) => (
                  <QRow key={e.w} e={e} trained={trainedSet.has(fold(e.w))} />
                ))}
              </div>
            ) : (
              !qLoading && camList.length === 0 && (
                <div className="card" style={{ gap: 6 }}>
                  <span className="h4">Chưa có “{q}”</span>
                  <span className="bm">Thử gõ ngắn hơn hoặc không dấu, ví dụ “benh vien”.</span>
                </div>
              )
            )}
            {qHits.length > 60 && <span className="sm">Còn {qHits.length - 60} từ nữa, gõ cụ thể hơn để thu hẹp.</span>}
          </div>
          )}
        </section>
      ) : (
        <>
          <Segmented<Tab>
            label="Nguồn từ điển"
            value={tab}
            onChange={pickTab}
            items={[
              { v: "cam", label: `Chấm camera · ${labels.length}` },
              { v: "all", label: `Bộ GD&ĐT · ${entries.length ? entries.length.toLocaleString("vi") : "…"}` },
            ]}
          />

          {tab === "cam" ? (
            <div className="split">
              <div className="col" style={{ gap: 16 }}>
                {wordOfDay && (
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
                <span className="sm">{camList.length} từ</span>
                {loading ? (
                  <div className="skeleton" style={{ height: 300 }} />
                ) : (
                  groups.map(([l, ws]) => (
                    <div key={l}>
                      <div className="letter">{l}</div>
                      <div className="rows">
                        {ws.map((w) => (
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
          ) : (
            <section className="col" style={{ gap: 12 }} aria-label="Từ điển Bộ GD&ĐT">
              <div className="letters" role="group" aria-label="Chọn chữ cái">
                {letters.map((l) => (
                  <button key={l} type="button" aria-pressed={l === letter} onClick={() => setLetter(l)}>
                    {l}
                  </button>
                ))}
                <button type="button" aria-pressed={letter === "#"} onClick={() => setLetter("#")} aria-label="Số và chữ cái ngón tay" style={{ width: "auto", padding: "0 12px" }}>
                  Số, chữ
                </button>
              </div>
              {qLoading ? (
                <div className="skeleton" style={{ height: 300 }} />
              ) : (
                <>
                  <div className="row row--between">
                    <span className="h3" style={{ color: "var(--acc)" }}>
                      {letter === "#" ? "Số & chữ cái" : letter}
                    </span>
                    <span className="sm num">{byLetter.length} từ</span>
                  </div>
                  <div className="rows mgrid-rows">
                    {byLetter.map((e) => (
                      <QRow key={e.w} e={e} trained={trainedSet.has(fold(e.w))} />
                    ))}
                  </div>
                </>
              )}
              <p className="sm" style={{ margin: 0 }}>
                Nguồn: {QIPEDC_SOURCE}. Video phát qua mạng.
              </p>
            </section>
          )}
        </>
      )}
      <BottomNav />
    </main>
  );
}
