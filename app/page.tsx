"use client";

import { asset } from "@/lib/base";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronRight, Lock, MessageCircle, Play, Map, Star, Sparkles, Gift, RotateCcw, AlertTriangle } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import LoopVideo from "@/components/LoopVideo";
import { Bar, Btn } from "@/components/ui";
import { buildLessons } from "@/lib/lessons";
import { useLabels } from "@/lib/useLabels";
import { useProgress } from "@/lib/useProgress";
import { useProfile } from "@/lib/profile";
import { countLearned, dayStreak, isLearned, todayCount, dueWords } from "@/lib/progress";
import { lessonUrl, practiceUrl } from "@/lib/nav";
import { thumbUrl } from "@/lib/theme";

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Chào buổi sáng" : h < 14 ? "Chào buổi trưa" : h < 18 ? "Chào buổi chiều" : "Chào buổi tối";
}

/** Figma · Học một bài · "01 Lộ trình" (258:7362) */
export default function Home() {
  const router = useRouter();
  const { profile, ready } = useProfile();
  const { labels, loading } = useLabels();
  const [progress] = useProgress();

  useEffect(() => {
    if (ready && !profile.onboarded) router.replace("/chao-mung");
  }, [ready, profile.onboarded, router]);

  const lessons = useMemo(() => buildLessons(labels), [labels]);
  const streak = dayStreak(progress);
  const today = todayCount(progress);
  const goal = progress.dailyGoal;
  const learned = (w: string) => isLearned(progress, w);

  // Chặng đang học = chặng đầu tiên chưa thuộc hết; bài hiện tại = từ đầu tiên chưa thuộc
  const current = lessons.find((l) => countLearned(progress, l.words) < l.words.length) ?? lessons[0];
  const stageIdx = current ? lessons.indexOf(current) : 0;
  const curWordIdx = current ? Math.max(0, current.words.findIndex((w) => !learned(w))) : 0;
  const nextWord = current?.words[curWordIdx];
  const done = current ? countLearned(progress, current.words) : 0;

  return (
    <main className="app app--nav" style={{ gap: 24 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="deco-cloud" src={asset("/img/figma/cloud.webp")} alt="" style={{ top: 0, right: -30 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="deco-wave" src={asset("/img/figma/wave.svg")} alt="" style={{ top: 640 }} />

      <header className="row row--between">
        <div className="col" style={{ gap: 4, position: "relative" }}>
          <span className="bm" style={{ fontSize: 14, fontWeight: 400 }}>
            {greeting()}
            {profile.name ? `, ${profile.name}` : ""}
          </span>
          <h1 className="h1">Lộ trình học</h1>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="deco-sparkle" src={asset("/img/figma/sparkle.svg")} alt="" style={{ left: 140, top: 18 }} />
        </div>
        <Link href="/ho-so" className="badge badge--yel" style={{ height: 44, padding: "0 14px" }} aria-label={`Chuỗi ${streak} ngày, xem hồ sơ`}>
          Chuỗi {streak} ngày
        </Link>
      </header>

      {/* 1. Hộp ôn tập thông minh (Daily SRS Review Banner) */}
      {(() => {
        const dueList = dueWords(progress, labels);
        if (dueList.length === 0) return null;
        return (
          <section
            className="card"
            style={{
              background: "linear-gradient(135deg, var(--yel-soft), var(--brand-soft))",
              borderColor: "transparent",
              padding: "16px 18px",
              boxShadow: "var(--shadow-tile)",
              gap: 12,
            }}
            aria-label="Cần ôn tập hôm nay"
          >
            <div className="row row--between" style={{ alignItems: "center" }}>
              <div className="row" style={{ gap: 10, alignItems: "center" }}>
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "var(--yel)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--yel-txt)",
                  }}
                  aria-hidden
                >
                  <RotateCcw size={22} />
                </span>
                <div className="col col--tight">
                  <span className="bb" style={{ fontSize: 16, color: "var(--txt)" }}>
                    Hộp ôn tập hôm nay
                  </span>
                  <span className="sm" style={{ color: "var(--txt2)" }}>
                    {dueList.length} từ cần củng cố trí nhớ
                  </span>
                </div>
              </div>
              <Btn href="/the-ghi-nho" size="sm" style={{ minHeight: 44, padding: "0 14px", fontWeight: 700 }}>
                Ôn ngay
              </Btn>
            </div>
          </section>
        );
      })()}

      {/* Tiếp tục học */}
      {current && nextWord && (
        <section className="continue" aria-label="Tiếp tục học">
          <div className="col grow" style={{ gap: 8, minWidth: 0 }}>
            <span className="badge badge--s badge--acc">Bài {String(curWordIdx + 1).padStart(2, "0")}</span>
            <h2 className="h2">{nextWord}</h2>
            <span className="t-sub">{current.words.length - done > 1 ? `Còn ${current.words.length - done} ký hiệu nữa` : "Ký hiệu cuối của chặng"}</span>
            <Btn href={practiceUrl(nextWord, current.id)} size="md" block={false} style={{ minHeight: 44, fontSize: 14, padding: "0 16px", width: "fit-content", boxShadow: "none" }}>
              Học tiếp <ArrowRight size={20} aria-hidden />
            </Btn>
          </div>
          <div className="continue-media">
            <LoopVideo word={nextWord} style={{ width: "100%", height: "100%", borderRadius: 0 }} />
          </div>
        </section>
      )}

      {/* Mục tiêu hôm nay */}
      <section className="goal" aria-label="Mục tiêu hôm nay">
        <div className="goal-row">
          <span style={{ color: "var(--ink)" }}>Mục tiêu hôm nay</span>
          <span style={{ color: "var(--acc)" }} className="num">
            {Math.min(today, goal)} / {goal} lần ký đúng
          </span>
        </div>
        <Bar pct={(today / goal) * 100} h={8} color="var(--brand)" />
      </section>

      {/* Chặng hiện tại: Bản đồ lộ trình học Lingvano Node Roadmap */}
      {loading && [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 74, borderRadius: 20 }} />)}
      {current && (
        <section className="col" style={{ gap: 16 }} aria-label={`Bản đồ chặng ${stageIdx + 1}`}>
          <div className="card" style={{ padding: "16px 18px", background: "var(--surface)", boxShadow: "var(--shadow-tile)", gap: 10 }}>
            <div className="row row--between" style={{ alignItems: "center" }}>
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <span className="badge badge--s badge--acc">Chặng {stageIdx + 1}</span>
                <h2 className="h4" style={{ color: "var(--ink)", margin: 0 }}>
                  {current.title}
                </h2>
              </div>
              <span className="t-sub num" style={{ color: "var(--acc)", fontWeight: 700 }}>
                {done}/{current.words.length} bài
              </span>
            </div>
            <Bar pct={(done / current.words.length) * 100} h={6} color="var(--brand)" />
          </div>

          {/* Node Map đường mòn uốn lượn phong cách Lingvano */}
          <div
            className="col"
            style={{
              position: "relative",
              padding: "16px 0 24px",
              gap: 20,
              alignItems: "center",
            }}
          >
            {/* Đường ray kết nối chính giữa */}
            <div
              style={{
                position: "absolute",
                top: 30,
                bottom: 30,
                width: 6,
                background: "var(--line)",
                borderRadius: 4,
                zIndex: 0,
              }}
            />

            {current.words.map((w, i) => {
              const ok = learned(w);
              const isCur = i === curWordIdx && !ok;
              const locked = !ok && i > curWordIdx;
              // Zigzag shift so le kiểu Lingvano: giữa -> lệch trái -> lệch phải
              const offset = i % 3 === 1 ? -42 : i % 3 === 2 ? 42 : 0;

              return (
                <div
                  key={w}
                  style={{
                    position: "relative",
                    zIndex: 1,
                    transform: `translateX(${offset}px)`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {locked ? (
                    <div
                      style={{
                        width: 68,
                        height: 68,
                        borderRadius: "50%",
                        background: "var(--sunk)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--txt2)",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                        border: "3px solid var(--surface)",
                      }}
                      title={`${w} (Chưa mở)`}
                    >
                      <Lock size={24} aria-hidden />
                    </div>
                  ) : (
                    <Link
                      href={practiceUrl(w, current.id)}
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: "50%",
                        background: ok
                          ? "var(--pos)"
                          : isCur
                          ? "var(--brand)"
                          : "var(--surface)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: ok || isCur ? "#fff" : "var(--acc)",
                        boxShadow: isCur
                          ? "0 0 0 6px var(--brand-soft), 0 8px 24px rgba(44, 99, 196, 0.35)"
                          : "0 6px 18px rgba(0,0,0,0.1)",
                        border: "3px solid #fff",
                        textDecoration: "none",
                        transition: "transform 0.2s ease",
                      }}
                      aria-label={`Bài học ${w}, ${ok ? "đã hoàn thành" : "bắt đầu học"}`}
                    >
                      {ok ? (
                        <CheckCircle2 size={32} color="#fff" aria-hidden />
                      ) : isCur ? (
                        <Play size={28} fill="#fff" color="#fff" aria-hidden style={{ marginLeft: 3 }} />
                      ) : (
                        <Star size={26} fill="var(--acc)" color="var(--acc)" aria-hidden />
                      )}
                    </Link>
                  )}
                  <span
                    className="bb"
                    style={{
                      fontSize: 13,
                      background: isCur ? "var(--brand-soft)" : "var(--surface)",
                      color: isCur ? "var(--blu-txt)" : locked ? "var(--txt2)" : "var(--txt)",
                      padding: "2px 10px",
                      borderRadius: 12,
                      boxShadow: "var(--shadow-tile)",
                      maxWidth: 110,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontWeight: isCur ? 700 : 600,
                    }}
                  >
                    {w}
                  </span>
                  {/* Rương báu mở quà (Treasure Chest Milestone) phong cách Lingvano sau mỗi 3 bài */}
                  {(i + 1) % 4 === 0 && (
                    <div
                      style={{
                        position: "relative",
                        zIndex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 10,
                        marginBottom: 10,
                      }}
                    >
                      <button
                        type="button"
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 20,
                          background: ok ? "var(--yel)" : "var(--sunk)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: ok ? "var(--yel-txt)" : "var(--txt2)",
                          boxShadow: ok ? "0 8px 24px rgba(252, 207, 72, 0.45)" : "none",
                          border: "3px solid #fff",
                          cursor: ok ? "pointer" : "default",
                        }}
                        onClick={() => {
                          if (ok) alert("🎉 Bạn đã mở rương báu! Nhận thêm 20 XP và 1 khiên bảo vệ chuỗi!");
                        }}
                        aria-label={`Rương thưởng mốc ${Math.floor((i + 1) / 4)}`}
                      >
                        <Gift size={28} aria-hidden />
                      </button>
                      <span className="sm num" style={{ fontSize: 11, fontWeight: 700, color: ok ? "var(--org-txt)" : "var(--txt2)" }}>
                        {ok ? "Mở rương" : "Rương khóa"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Các chặng khác */}
      {lessons.length > 1 && (
        <section className="col" style={{ gap: 12 }} aria-label="Các chặng">
          <h2 className="sub">Các chặng</h2>
          {lessons.map((l, i) => {
            if (l.id === current?.id) return null;
            const d = countLearned(progress, l.words);
            const complete = d === l.words.length;
            return (
              <Link key={l.id} href={lessonUrl(l.id)} className="lrow">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="thumb" src={thumbUrl(l.words[0])} alt="" loading="lazy" />
                <span className="col grow" style={{ gap: 2, minWidth: 0 }}>
                  <span className="t-title">
                    Chặng {i + 1} · {l.title}
                  </span>
                  <span className="t-sub num">
                    {d}/{l.words.length} từ
                  </span>
                </span>
                {complete ? <CheckCircle2 size={28} fill="var(--pos)" color="#fff" aria-label="Đã xong" /> : <ChevronRight size={22} color="var(--txt3)" aria-hidden />}
              </Link>
            );
          })}
          <Link href="/cau" className="lrow">
            <span className="thumb" style={{ background: "var(--pur-soft)", color: "var(--pur-txt)" }}>
              <MessageCircle size={22} aria-hidden />
            </span>
            <span className="col grow" style={{ gap: 2, minWidth: 0 }}>
              <span className="t-title">Câu giao tiếp</span>
              <span className="t-sub">59 câu: chào hỏi, đi khám, mua sắm…</span>
            </span>
            <ChevronRight size={22} color="var(--txt3)" aria-hidden />
          </Link>
        </section>
      )}
      {!loading && labels.length === 0 && <div className="card">Chưa có dữ liệu từ (labels.json).</div>}
      <BottomNav />
    </main>
  );
}
