"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronRight, Lock, MessageCircle, Play } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import LoopVideo from "@/components/LoopVideo";
import { Bar, Btn } from "@/components/ui";
import { buildLessons } from "@/lib/lessons";
import { useLabels } from "@/lib/useLabels";
import { useProgress } from "@/lib/useProgress";
import { useProfile } from "@/lib/profile";
import { countLearned, dayStreak, isLearned, todayCount } from "@/lib/progress";
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
      <img className="deco-cloud" src="/img/figma/cloud.webp" alt="" style={{ top: 0, right: -30 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="deco-wave" src="/img/figma/wave.svg" alt="" style={{ top: 640 }} />

      <header className="row row--between">
        <div className="col" style={{ gap: 4, position: "relative" }}>
          <span className="bm" style={{ fontSize: 14, fontWeight: 400 }}>
            {greeting()}
            {profile.name ? `, ${profile.name}` : ""}
          </span>
          <h1 className="h1">Lộ trình học</h1>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="deco-sparkle" src="/img/figma/sparkle.svg" alt="" style={{ left: 140, top: 18 }} />
        </div>
        <Link href="/ho-so" className="badge badge--yel" style={{ height: 44, padding: "0 14px" }} aria-label={`Chuỗi ${streak} ngày, xem hồ sơ`}>
          Chuỗi {streak} ngày
        </Link>
      </header>

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

      {/* Chặng hiện tại: danh sách bài */}
      {loading && [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 74, borderRadius: 20 }} />)}
      {current && (
        <section className="col" style={{ gap: 12 }} aria-label={`Chặng ${stageIdx + 1}`}>
          <div className="row row--between" style={{ marginBottom: 12 }}>
            <h2 className="h4" style={{ color: "var(--ink)" }}>
              Chặng {stageIdx + 1} · {current.title}
            </h2>
            <span className="t-sub num" style={{ color: "var(--acc)", fontWeight: 600 }}>
              {done}/{current.words.length} bài
            </span>
          </div>
          {current.words.map((w, i) => {
            const ok = learned(w);
            const isCur = i === curWordIdx && !ok;
            const locked = !ok && i > curWordIdx;
            if (locked)
              return (
                <div key={w} className="lrow lrow--lock" aria-label={`${w}, chưa mở`}>
                  <span className="thumb" style={{ background: "var(--sunk)" }}>
                    <Lock size={22} aria-hidden />
                  </span>
                  <span className="col grow" style={{ gap: 2, minWidth: 0 }}>
                    <span className="t-title" style={{ color: "inherit" }}>
                      {w}
                    </span>
                    <span className="t-sub" style={{ color: "inherit" }}>
                      Mở sau bài {current.words[i - 1]}
                    </span>
                  </span>
                </div>
              );
            return (
              <Link key={w} href={practiceUrl(w, current.id)} className={`lrow ${isCur ? "lrow--cur" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="thumb" src={thumbUrl(w)} alt="" loading="lazy" />
                <span className="col grow" style={{ gap: 2, minWidth: 0 }}>
                  <span className="t-title">{w}</span>
                  <span className="t-sub">{ok ? "Đã xong · 100%" : `Đang học · ${done}/${current.words.length}`}</span>
                </span>
                {ok ? <CheckCircle2 size={28} fill="var(--pos)" color="#fff" aria-label="Đã xong" /> : <Play size={18} fill="var(--acc)" color="var(--acc)" aria-hidden />}
              </Link>
            );
          })}
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
