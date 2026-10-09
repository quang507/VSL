"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, Target, RotateCcw, ChevronRight, CheckCircle2, MessageCircle } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Bar, Btn, IconCircle, Pill, SectionTitle, Sticker } from "@/components/ui";
import { buildLessons } from "@/lib/lessons";
import { useLabels } from "@/lib/useLabels";
import { useProgress } from "@/lib/useProgress";
import { useProfile } from "@/lib/profile";
import { countLearned, dayStreak, dueWords, isLearned, todayCount } from "@/lib/progress";
import { lessonUrl, practiceUrl } from "@/lib/nav";
import { TONE, lessonIcon } from "@/lib/theme";

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Chào buổi sáng" : h < 14 ? "Chào buổi trưa" : h < 18 ? "Chào buổi chiều" : "Chào buổi tối";
}

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
  const due = useMemo(() => dueWords(progress, labels), [progress, labels]);

  // Bài đang học = bài đầu tiên chưa thuộc hết
  const current = lessons.find((l) => countLearned(progress, l.words) < l.words.length) ?? lessons[0];
  const nextWord = current?.words.find((w) => !isLearned(progress, w)) ?? current?.words[0];
  const curDone = current ? countLearned(progress, current.words) : 0;

  return (
    <main className="app app--nav">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="cloud" src="/img/cloud.png" alt="" />
      <div className="row row--between" style={{ position: "relative" }}>
        <div className="col col--tight">
          <span className="bm">
            {greeting()}
            {profile.name ? `, ${profile.name}` : ""}
          </span>
          <h1 className="h1">Lộ trình học</h1>
        </div>
        <Link href="/ho-so" className="pill" style={{ background: "var(--surface)", boxShadow: "var(--shadow-soft)", minHeight: 44, padding: "8px 14px" }} aria-label={`Chuỗi ${streak} ngày`}>
          <Zap size={20} color="var(--org)" fill="var(--org)" aria-hidden />
          <span className="bb">{streak} ngày</span>
        </Link>
      </div>

      {/* Học tiếp */}
      {current && nextWord && (
        <section className="hero hero--deep">
          <div className="col" style={{ flex: 1, gap: 8 }}>
            <span className="bb" style={{ opacity: 0.85 }}>
              Học tiếp · {current.title}
            </span>
            <span className="h2" style={{ color: "#fff" }}>
              {nextWord}
            </span>
            <span className="bm" style={{ color: "rgba(255,255,255,.85)" }}>
              {curDone}/{current.words.length} ký hiệu đã thuộc
            </span>
            <Bar pct={(curDone / current.words.length) * 100} color="var(--yel)" track="rgba(255,255,255,.2)" />
            <div style={{ marginTop: 6 }}>
              <Btn href={practiceUrl(nextWord, current.id)} level="tertiary" size="md" block={false}>
                Học ngay
              </Btn>
            </div>
          </div>
          <Sticker src="/img/mascot_cheer.png" size={108} rot={-6} />
        </section>
      )}

      {/* Mục tiêu hôm nay */}
      <section className="card">
        <div className="row">
          <IconCircle icon={Target} bg="var(--grn-soft)" fg="var(--grn-txt)" />
          <div className="col col--tight grow">
            <span className="bb">Mục tiêu hôm nay</span>
            <span className="sm">{today >= goal ? "Đã đạt mục tiêu, giỏi lắm!" : `Còn ${goal - today} lần ký đúng nữa`}</span>
          </div>
          <span className="h4">
            {Math.min(today, goal)}/{goal}
          </span>
        </div>
        <Bar pct={(today / goal) * 100} color="var(--grn)" />
      </section>

      {due.length > 0 && (
        <Link href="/quiz?mode=review" className="tile t-blu" style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <IconCircle icon={RotateCcw} bg="var(--surface)" fg="var(--acc)" />
          <div className="col col--tight grow">
            <span className="bb">{due.length} từ đến hạn ôn</span>
            <span className="sm">Ôn đúng lúc giúp nhớ lâu hơn</span>
          </div>
          <ChevronRight size={22} aria-hidden />
        </Link>
      )}

      <SectionTitle>Các chặng</SectionTitle>
      {loading && [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 88, borderRadius: 24 }} />)}
      {!loading && labels.length === 0 && <div className="card">Chưa có dữ liệu từ (labels.json).</div>}

      <div className="col">
        {lessons.map((l, i) => {
          const done = countLearned(progress, l.words);
          const pct = (done / l.words.length) * 100;
          const complete = done === l.words.length;
          const Icon = lessonIcon(l.id);
          const isCurrent = l.id === current?.id;
          return (
            <Link
              key={l.id}
              href={lessonUrl(l.id)}
              className={`card card--row`}
              style={isCurrent ? { outline: "2px solid var(--brand)" } : undefined}
            >
              <span className={`icon-circle tile ${TONE[l.color]}`} style={{ width: 56, height: 56, padding: 0, borderRadius: 18 }}>
                <Icon size={26} className="tone-txt" aria-hidden />
              </span>
              <div className="col col--tight grow" style={{ minWidth: 0 }}>
                <span className="sm">Chặng {i + 1}</span>
                <span className="bb">{l.title}</span>
                <div className="row" style={{ gap: 8 }}>
                  <Bar pct={pct} h={6} color={complete ? "var(--grn)" : "var(--brand)"} />
                  <span className="sm" style={{ flex: "none" }}>
                    {done}/{l.words.length}
                  </span>
                </div>
              </div>
              {complete ? (
                <CheckCircle2 size={26} color="var(--grn)" aria-label="Đã hoàn thành" />
              ) : isCurrent ? (
                <Pill bg="var(--brand)" fg="#fff">
                  Đang học
                </Pill>
              ) : (
                <ChevronRight size={22} color="var(--txt3)" aria-hidden />
              )}
            </Link>
          );
        })}
      </div>
      <Link href="/cau" className="tile t-pur" style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <span className="icon-circle" style={{ width: 56, height: 56, background: "var(--surface)", borderRadius: 18 }}>
          <MessageCircle size={26} className="tone-txt" aria-hidden />
        </span>
        <span className="col col--tight grow">
          <span className="sm tone-txt">Chặng mở rộng</span>
          <span className="bb">Câu giao tiếp · 60 câu</span>
          <span className="sm">Hỏi đường, đi khám, mua sắm…</span>
        </span>
        <ChevronRight size={22} aria-hidden />
      </Link>
      <BottomNav />
    </main>
  );
}
