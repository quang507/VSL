"use client";

import { asset } from "@/lib/base";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, X, CheckCircle2, ChevronRight, Camera, ArrowRight, AlarmClock, RotateCcw, Zap, WifiOff, Play, Timer, Volume2 } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import LoopVideo from "@/components/LoopVideo";
import { Segmented } from "@/components/ui";
import { useLabels } from "@/lib/useLabels";
import { useProgress } from "@/lib/useProgress";
import { useProfile } from "@/lib/profile";
import { buildLessons } from "@/lib/lessons";
import { dayStreak, dueWords, isLearned } from "@/lib/progress";
import { practiceUrl } from "@/lib/nav";
import { thumbUrl } from "@/lib/theme";
import { useSaved } from "@/lib/saved";
import { useOnline } from "@/lib/useOnline";
import { speakVietnamese } from "@/lib/feedback";
import { QIPEDC_SOURCE, fold, useQipedc, wordUrl, videoUrl, preferredVariant, type QEntry } from "@/lib/qipedc";

// Chữ cái đầu theo bảng chữ Việt: bỏ dấu thanh, giữ Ă Â Đ Ê Ô Ơ Ư
const initial = (w: string) =>
  w.normalize("NFD").replace(/[̣̀́̃̉]/g, "").normalize("NFC").charAt(0).toUpperCase();

const ALPHABET = "A Ă Â B C D Đ E Ê G H I K L M N O Ô Ơ P Q R S T U Ư V X Y".split(" ");
const TOPIC_TONES = ["var(--brand-soft)", "var(--yel-soft)", "var(--grn-soft)", "var(--pnk-soft)", "var(--pur-soft)", "var(--org-soft)"];
type Tab = "cam" | "abc" | "all";

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Chào buổi sáng" : h < 14 ? "Chào buổi trưa" : h < 18 ? "Chào buổi chiều" : "Chào buổi tối";
}

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
  const first = e.s[0];
  const n = Object.keys(first.v).length;
  return (
    <Link href={wordUrl(e.w)}>
      <span className="col col--tight grow" style={{ minWidth: 0 }}>
        <span className="bb">{e.w}</span>
        <span className="sm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {[e.s.length > 1 ? `${e.s.length} nghĩa` : first.t, n > 1 ? `${n} miền` : "", first.d].filter(Boolean).join(" · ")}
        </span>
      </span>
      {trained && <Camera size={20} color="var(--acc)" aria-label="Chấm được bằng camera" />}
      <ChevronRight size={20} color="var(--txt3)" aria-hidden />
    </Link>
  );
}

/** Figma · Tra từ điển · "01 Dictionary Home" (330:6601) + danh sách đầy đủ hai nguồn */
export default function Dictionary() {
  const { labels, loading } = useLabels();
  const { entries, loading: qLoading } = useQipedc();
  const [progress] = useProgress();
  const { profile } = useProfile();
  const { saved } = useSaved();
  const online = useOnline();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("cam");
  const [topic, setTopic] = useState<string>("all");
  const [allTopics, setAllTopics] = useState(false);
  const [letter, setLetter] = useState("A");
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lessons = useMemo(() => buildLessons(labels), [labels]);
  const topicOf = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of lessons) for (const w of l.words) m[w] = l.title;
    return m;
  }, [lessons]);
  const trainedSet = useMemo(() => new Set(labels.map(fold)), [labels]);
  const due = useMemo(() => new Set(dueWords(progress, labels)), [progress, labels]);

  // Nhớ tab; hỗ trợ URL param ?tab=cam|abc|all; nút tìm ở thanh điều hướng mở trang với ?tim=1 → focus ô tìm
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const urlTab = sp.get("tab") as Tab | null;
      if (urlTab === "all" || urlTab === "cam" || urlTab === "abc") {
        setTab(urlTab);
      } else {
        const t = localStorage.getItem("vsl-dict-tab");
        if (t === "all" || t === "cam" || t === "abc") setTab(t);
      }
      if (sp.get("tim")) searchRef.current?.focus();
    } catch {}
  }, []);
  const pickTab = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem("vsl-dict-tab", t);
    } catch {}
  };

  const alphabetEntries = useMemo(() => entries.filter((e) => e.k === 2), [entries]);
  const numberEntries = useMemo(() => entries.filter((e) => e.k === 1), [entries]);

  const wordOfDay = useMemo(() => {
    if (!labels.length) return "";
    const d = new Date();
    return labels[(d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate()) % labels.length];
  }, [labels]);

  // Từ đã học gần đây: theo lần luyện cuối
  const recent = useMemo(
    () =>
      Object.entries(progress.words)
        .filter(([w, s]) => labels.includes(w) && s.attempts > 0)
        .sort((a, b) => (b[1].last ?? 0) - (a[1].last ?? 0))
        .slice(0, 3),
    [progress, labels]
  );

  const f = fold(q);
  const camList = useMemo(() => {
    const base = topic === "all" ? labels : lessons.find((l) => l.id === topic)?.words ?? [];
    return (f ? base.filter((w) => fold(w).includes(f)) : base).slice().sort((a, b) => a.localeCompare(b, "vi"));
  }, [labels, lessons, topic, f]);
  const groups = useMemo(() => groupByLetter(camList), [camList]);

  // ---- Fingerspelling Speed Trainer State ----
  const [trainerActive, setTrainerActive] = useState(false);
  const [trainerTarget, setTrainerTarget] = useState<QEntry | null>(null);
  const [trainerChoices, setTrainerChoices] = useState<string[]>([]);
  const [trainerScore, setTrainerScore] = useState(0);
  const [trainerStreak, setTrainerStreak] = useState(0);
  const [trainerFeedback, setTrainerFeedback] = useState<"ok" | "no" | null>(null);

  const startNextTrainerRound = (entriesPool: QEntry[]) => {
    if (!entriesPool.length) return;
    const pool = entriesPool.filter((e) => e.k === 2 || e.k === 1);
    const target = pool[Math.floor(Math.random() * pool.length)];
    const otherPool = pool.filter((e) => e.w !== target.w);
    const distractors: string[] = [];
    while (distractors.length < 3 && otherPool.length > 0) {
      const rand = otherPool[Math.floor(Math.random() * otherPool.length)].w;
      if (!distractors.includes(rand)) distractors.push(rand);
    }
    const shuffled = [target.w, ...distractors].sort(() => Math.random() - 0.5);
    setTrainerTarget(target);
    setTrainerChoices(shuffled);
    setTrainerFeedback(null);
  };

  const handleTrainerAnswer = (chosen: string) => {
    if (!trainerTarget || trainerFeedback !== null) return;
    if (chosen === trainerTarget.w) {
      setTrainerScore((s) => s + 10);
      setTrainerStreak((st) => st + 1);
      setTrainerFeedback("ok");
      speakVietnamese(trainerTarget.w);
      setTimeout(() => {
        startNextTrainerRound(entries);
      }, 700);
    } else {
      setTrainerStreak(0);
      setTrainerFeedback("no");
      setTimeout(() => {
        setTrainerFeedback(null);
      }, 900);
    }
  };

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

  const openTopic = (id: string) => {
    setTopic(id);
    pickTab("cam");
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const savedHref = (w: string) => (labels.includes(w) ? practiceUrl(w) : wordUrl(w));

  return (
    <main className="app app--nav" style={{ gap: 16 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="deco-cloud" src={asset("/img/figma/cloud.webp")} alt="" style={{ width: 130 }} />
      <header className="row row--between">
        <div className="col" style={{ gap: 2 }}>
          <span className="bm" style={{ fontSize: 14 }}>
            {greeting()}
            {profile.name ? `, ${profile.name}` : ""}
          </span>
          <h1 className="h1">Từ điển VSL</h1>
        </div>
        <span className="badge badge--s badge--yel-subtle">
          <Zap size={12} fill="var(--org)" color="var(--org)" aria-hidden /> {dayStreak(progress)} ngày
        </span>
      </header>

      <label className="search">
        <Search size={20} color="var(--acc)" aria-hidden />
        <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm từ bạn muốn học" aria-label="Tìm từ, gõ có dấu hoặc không dấu" />
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
              <span className="sub">Luyện được với camera · {camList.length}</span>
              <div className="rows">
                {camList.map((w) => (
                  <Link key={w} href={practiceUrl(w)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="thumb" src={thumbUrl(w)} alt="" loading="lazy" />
                    <span className="col col--tight grow">
                      <span className="bb">{w}</span>
                      <span className="sm">{topicOf[w]}</span>
                    </span>
                    {isLearned(progress, w) ? <CheckCircle2 size={24} fill="var(--pos)" color="#fff" aria-label="Đã thuộc" /> : <Camera size={20} color="var(--acc)" aria-hidden />}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {(qLoading || qHits.length > 0 || camList.length === 0) && (
            <div className="col" style={{ gap: 8 }}>
              <span className="sub">Từ điển Bộ GD&ĐT · {qLoading ? "…" : qHits.length}</span>
              {qHits.length > 0 ? (
                <div className="rows">
                  {qHits.slice(0, 60).map((e) => (
                    <QRow key={e.w} e={e} trained={trainedSet.has(fold(e.w))} />
                  ))}
                </div>
              ) : (
                !qLoading && (
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
          {/* Từ của ngày */}
          {!wordOfDay && <div className="skeleton" style={{ height: 128, borderRadius: 24 }} />}
          {wordOfDay && (
            <Link href={practiceUrl(wordOfDay)} className="wod">
              <span className="col" style={{ gap: 8, maxWidth: "calc(100% - 140px)" }}>
                <span className="badge badge--s badge--yel">
                  <Zap size={12} fill="currentColor" aria-hidden /> Từ của ngày
                </span>
                <span className="d4" style={{ wordBreak: "break-word" }}>
                  {wordOfDay}
                </span>
                <span className="t-sub">{topicOf[wordOfDay]}</span>
              </span>
              <span className="wod-media">
                <LoopVideo word={wordOfDay} style={{ width: "100%", height: "100%", borderRadius: 0 }} />
              </span>
            </Link>
          )}

          {/* Chủ đề phổ biến */}
          <div className="row row--between" style={{ marginTop: 8 }}>
            <h2 className="sub">Chủ đề phổ biến</h2>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAllTopics(!allTopics)} style={{ minHeight: 44 }}>
              {allTopics ? "Thu gọn" : "Tất cả"} <ArrowRight size={16} aria-hidden />
            </button>
          </div>
          <div className="topics">
            {lessons.length === 0 && [0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 20 }} />)}
            {(allTopics ? lessons : lessons.slice(0, 4)).map((l, i) => (
              <button key={l.id} type="button" className="topic" style={{ background: TOPIC_TONES[i % TOPIC_TONES.length] }} onClick={() => openTopic(l.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="thumb" src={thumbUrl(l.words[0])} alt="" loading="lazy" />
                <span className="col" style={{ minWidth: 0 }}>
                  <span className="t-title" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {l.title.split(" & ")[0]}
                  </span>
                  <span className="t-sub">{l.words.length} từ</span>
                </span>
              </button>
            ))}
          </div>

          {/* Từ đã học gần đây */}
          {recent.length > 0 && (
            <>
              <div className="row row--between" style={{ marginTop: 8 }}>
                <h2 className="sub row" style={{ gap: 8 }}>
                  <AlarmClock size={20} color="var(--acc)" aria-hidden /> Từ đã học gần đây
                </h2>
                <span className="t-sub" style={{ fontWeight: 600 }}>
                  {due.size} từ cần ôn lại
                </span>
              </div>
              {recent.map(([w, s]) => {
                const pct = Math.round((s.correct / s.attempts) * 100);
                return (
                  <Link key={w} href={practiceUrl(w)} className="lrow" style={{ gap: 16 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="thumb thumb--52" src={thumbUrl(w)} alt="" loading="lazy" />
                    <span className="col grow" style={{ gap: 2, minWidth: 0 }}>
                      <span className="t-title">{w}</span>
                      <span className="row" style={{ gap: 12 }}>
                        <span className="minibar">
                          <i style={{ width: `${pct}%`, background: pct === 100 ? "var(--grn)" : "var(--brand)" }} />
                        </span>
                        <span className="t-sub num" style={{ fontWeight: 600, color: pct === 100 ? "var(--pos)" : "var(--acc)" }}>
                          {pct}%
                        </span>
                      </span>
                    </span>
                    <span className="btn btn--soft" style={{ minHeight: 32, borderRadius: 999, gap: 4 }}>
                      <RotateCcw size={18} aria-hidden /> Ôn tập
                    </span>
                  </Link>
                );
              })}
            </>
          )}

          {/* Đã lưu gần đây */}
          {saved.length > 0 && (
            <>
              <div className="row row--between" style={{ marginTop: 8 }}>
                <h2 className="sub">Đã lưu gần đây</h2>
                <span className="t-sub" style={{ fontWeight: 600, color: "var(--acc)" }}>
                  {saved.length} từ
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {saved.slice(0, 3).map((w) => {
                  const c = Math.min(progress.words[w]?.correct ?? 0, 3);
                  return (
                    <Link key={w} href={savedHref(w)} className="lrow" style={{ flexDirection: "column", gap: 8, alignItems: "center", minWidth: 0 }}>
                      {labels.includes(w) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="thumb thumb--72" src={thumbUrl(w)} alt="" loading="lazy" />
                      ) : (
                        <span className="thumb thumb--72 h3" style={{ background: "var(--brand-soft)", color: "var(--ink)" }} aria-hidden>
                          {w.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="t-sub" style={{ color: "var(--txt)", fontWeight: 600, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {w}
                      </span>
                      <span className="mastery" aria-label={`Đã ký đúng ${c} lần`}>
                        {[0, 1, 2].map((k) => (
                          <i key={k} className={k < c ? "on" : ""} />
                        ))}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {/* Tất cả từ: hai nguồn */}
          <div ref={listRef} className="col" style={{ gap: 12, marginTop: 8, scrollMarginTop: 16 }}>
            <h2 className="sub">Tất cả từ</h2>
            <Segmented<Tab>
              label="Nguồn từ điển"
              value={tab}
              onChange={pickTab}
              items={[
                { v: "cam", label: `Camera · ${labels.length}` },
                { v: "abc", label: "Chữ cái & Số" },
                { v: "all", label: `Bộ GD&ĐT · ${entries.length ? entries.length.toLocaleString("vi") : "…"}` },
              ]}
            />
          </div>

          {tab === "cam" ? (
            <section className="col" style={{ gap: 8 }} aria-label="Danh sách từ chấm bằng camera">
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
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img className="thumb" src={thumbUrl(w)} alt="" loading="lazy" />
                          <span className="col col--tight grow">
                            <span className="bb">{w}</span>
                            <span className="sm">{topicOf[w]}</span>
                          </span>
                          {isLearned(progress, w) && <CheckCircle2 size={24} fill="var(--pos)" color="#fff" aria-label="Đã thuộc" />}
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
          ) : tab === "abc" ? (
            <section className="col" style={{ gap: 20 }} aria-label="Bảng chữ cái và chữ số ngón tay">
              {/* Fingerspelling Speed Trainer */}
              <div
                className="card"
                style={{
                  gap: 12,
                  background: trainerActive ? "var(--surface)" : "var(--brand-soft)",
                  borderColor: trainerActive ? "var(--acc)" : "transparent",
                  padding: "16px 18px",
                  boxShadow: "var(--shadow-tile)",
                }}
              >
                {!trainerActive ? (
                  <div className="col" style={{ gap: 8 }}>
                    <div className="row row--between" style={{ alignItems: "center" }}>
                      <span className="h4" style={{ color: "var(--acc)" }}>Luyện phản xạ ngón tay (Speed Trainer)</span>
                      <span className="badge badge--s badge--acc">Lingvano Mode</span>
                    </div>
                    <span className="bm" style={{ color: "var(--txt)", fontSize: 14 }}>
                      Xem video ngón tay chuyển động và bấm chọn chữ cái tương ứng trong tích tắc để rèn phản xạ giao tiếp thực tế.
                    </span>
                    <button
                      type="button"
                      className="btn btn--primary btn--md"
                      style={{ marginTop: 4, alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 8 }}
                      onClick={() => {
                        setTrainerActive(true);
                        setTrainerScore(0);
                        setTrainerStreak(0);
                        startNextTrainerRound(entries);
                      }}
                    >
                      <Play size={18} fill="currentColor" aria-hidden />
                      Bắt đầu luyện phản xạ
                    </button>
                  </div>
                ) : (
                  <div className="col" style={{ gap: 14 }}>
                    <div className="row row--between" style={{ alignItems: "center" }}>
                      <div className="row" style={{ gap: 8, alignItems: "center" }}>
                        <Timer size={20} color="var(--acc)" aria-hidden />
                        <span className="bb" style={{ color: "var(--acc)" }}>Chuỗi: {trainerStreak} 🔥</span>
                        <span className="sm num" style={{ color: "var(--txt2)" }}>Điểm: {trainerScore}</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn--tertiary btn--sm"
                        onClick={() => setTrainerActive(false)}
                      >
                        Dừng lại
                      </button>
                    </div>

                    {trainerTarget && (
                      <div className="col" style={{ alignItems: "center", gap: 12 }}>
                        {/* Video ký tự */}
                        <div
                          style={{
                            width: "100%",
                            maxWidth: 320,
                            aspectRatio: "16 / 9",
                            background: "#111",
                            borderRadius: 16,
                            overflow: "hidden",
                            position: "relative",
                          }}
                        >
                          {(() => {
                            const sense = trainerTarget.s[0];
                            const vKey = preferredVariant(sense, profile.region);
                            const vidId = sense.v[vKey as keyof typeof sense.v];
                            return vidId ? (
                              <video
                                key={vidId}
                                src={videoUrl(vidId)}
                                autoPlay
                                loop
                                muted
                                playsInline
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  transform: profile.leftHanded ? "scaleX(-1)" : undefined,
                                }}
                              />
                            ) : null;
                          })()}
                        </div>

                        {/* 4 Lựa chọn phản xạ */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", maxWidth: 320 }}>
                          {trainerChoices.map((choice) => (
                            <button
                              key={choice}
                              type="button"
                              className="btn btn--secondary btn--lg"
                              style={{
                                fontSize: 20,
                                fontWeight: 700,
                                minHeight: 52,
                                background:
                                  trainerFeedback === "ok" && choice === trainerTarget.w
                                    ? "var(--pos)"
                                    : "var(--surface)",
                                color:
                                  trainerFeedback === "ok" && choice === trainerTarget.w
                                    ? "#fff"
                                    : "var(--txt)",
                                borderColor:
                                  trainerFeedback === "ok" && choice === trainerTarget.w
                                    ? "var(--pos)"
                                    : "var(--edge)",
                              }}
                              onClick={() => handleTrainerAnswer(choice)}
                            >
                              {choice}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="card" style={{ gap: 6, background: "var(--surface)", padding: "16px 18px", boxShadow: "var(--shadow-tile)" }}>
                <span className="h4" style={{ color: "var(--txt)" }}>Tra cứu ngón tay (Fingerspelling)</span>
                <span className="bm" style={{ color: "var(--txt2)", fontSize: 14, lineHeight: 1.5 }}>
                  Nền tảng giao tiếp thiết yếu để đánh vần tên riêng, địa chỉ và chữ số. Chọn ký tự để xem video mẫu chuẩn Bộ GD&ĐT, tua chậm 0.5x và tự đối chiếu qua camera (Soi gương).
                </span>
              </div>

              <div className="col" style={{ gap: 10 }}>
                <div className="row row--between">
                  <h3 className="h4" style={{ color: "var(--txt)" }}>Bảng chữ cái & Dấu thanh</h3>
                  <span className="sm num">{alphabetEntries.length} ký tự</span>
                </div>
                {qLoading ? (
                  <div className="skeleton" style={{ height: 160 }} />
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 10 }}>
                    {alphabetEntries.map((e) => (
                      <Link
                        key={e.w}
                        href={wordUrl(e.w)}
                        className="tile"
                        style={{
                          padding: "12px 6px",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "var(--surface)",
                          boxShadow: "var(--shadow-tile)",
                          borderRadius: 16,
                          minHeight: 68,
                          textDecoration: "none",
                        }}
                        aria-label={`Ký tự ${e.w}`}
                      >
                        <span className="h3" style={{ color: "var(--acc)", margin: 0, lineHeight: 1 }}>{e.w}</span>
                        <span className="sm" style={{ fontSize: 11, color: "var(--txt2)", marginTop: 4, textAlign: "center" }}>
                          {e.w.length === 1 ? `Chữ ${e.w}` : e.w}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="col" style={{ gap: 10 }}>
                <div className="row row--between">
                  <h3 className="h4" style={{ color: "var(--txt)" }}>Chữ số ngón tay</h3>
                  <span className="sm num">{numberEntries.length} số</span>
                </div>
                {qLoading ? (
                  <div className="skeleton" style={{ height: 120 }} />
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 10 }}>
                    {numberEntries.map((e) => (
                      <Link
                        key={e.w}
                        href={wordUrl(e.w)}
                        className="tile"
                        style={{
                          padding: "12px 6px",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "var(--surface)",
                          boxShadow: "var(--shadow-tile)",
                          borderRadius: 16,
                          minHeight: 68,
                          textDecoration: "none",
                        }}
                        aria-label={`Số ${e.w}`}
                      >
                        <span className="h3" style={{ color: "var(--org)", margin: 0, lineHeight: 1 }}>{e.w}</span>
                        <span className="sm" style={{ fontSize: 11, color: "var(--txt2)", marginTop: 4, textAlign: "center" }}>
                          {e.w.length <= 2 ? `Số ${e.w}` : e.w}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <p className="sm" style={{ margin: 0 }}>
                Nguồn video: {QIPEDC_SOURCE}.
              </p>
            </section>
          ) : (
            <section className="col" style={{ gap: 12 }} aria-label="Từ điển Bộ GD&ĐT">
              {!online && (
                <div className="tile t-yel" role="status" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <WifiOff size={22} color="var(--yel-txt)" aria-hidden style={{ flex: "none" }} />
                  <span className="bm" style={{ color: "var(--txt)" }}>
                    Đang không có mạng. Video của từ điển này cần mạng. 100 từ ở tab “Chấm camera” vẫn học được.
                  </span>
                </div>
              )}
              <div className="letters" role="group" aria-label="Chọn chữ cái">
                {letters.map((l) => (
                  <button key={l} type="button" aria-pressed={l === letter} onClick={() => setLetter(l)}>
                    {l}
                  </button>
                ))}
                <button type="button" aria-pressed={letter === "#"} onClick={() => setLetter("#")} style={{ width: "auto", padding: "0 12px" }}>
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
                  <div className="rows">
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
