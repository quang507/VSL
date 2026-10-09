"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, MessageCircle, Play } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import LoopVideo from "@/components/LoopVideo";
import { Btn } from "@/components/ui";
import { buildLessons } from "@/lib/lessons";
import { useLabels } from "@/lib/useLabels";
import { useProgress } from "@/lib/useProgress";
import { useProfile } from "@/lib/profile";
import { countLearned, dayStreak, dueWords, isLearned, todayCount } from "@/lib/progress";
import { lessonUrl, practiceUrl } from "@/lib/nav";

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Chào buổi sáng" : h < 14 ? "Chào buổi trưa" : h < 18 ? "Chào buổi chiều" : "Chào buổi tối";
}

/** Mỗi ô = một ký hiệu trong bài; ô xanh = đã thuộc. */
function Dots({ words, learned, dark }: { words: string[]; learned: (w: string) => boolean; dark?: boolean }) {
  return (
    <span className={`dots ${dark ? "dots--dark" : ""}`} aria-hidden>
      {words.map((w) => (
        <i key={w} className={learned(w) ? "on" : ""} />
      ))}
    </span>
  );
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
  const learned = (w: string) => isLearned(progress, w);

  // Bài đang học = bài đầu tiên chưa thuộc hết
  const current = lessons.find((l) => countLearned(progress, l.words) < l.words.length) ?? lessons[0];
  const nextWord = current?.words.find((w) => !learned(w)) ?? current?.words[0];
  const curDone = current ? countLearned(progress, current.words) : 0;
  const curIdx = current ? lessons.indexOf(current) : 0;

  return (
    <main className="app app--nav">
      <header className="col col--tight">
        <span className="bm">
          {greeting()}
          {profile.name ? `, ${profile.name}` : ""}
        </span>
        <h1 className="h1">Lộ trình học</h1>
      </header>

      {/* Ba con số quan trọng trong một dải, thay cho 3 thẻ rời */}
      <section className="stats" aria-label="Tóm tắt hôm nay">
        <Link href="/ho-so">
          <span className="stat-v">
            {Math.min(today, goal)}
            <span className="faint">/{goal}</span>
          </span>
          <span className="stat-l">{today >= goal ? "Đạt mục tiêu" : "Hôm nay"}</span>
        </Link>
        <Link href="/ho-so">
          <span className="stat-v">{streak}</span>
          <span className="stat-l">Ngày liên tiếp</span>
        </Link>
        <Link href={due.length ? "/quiz?mode=review" : "/luyen-tap"}>
          <span className="stat-v" style={{ color: due.length ? "var(--acc)" : undefined }}>
            {due.length}
          </span>
          <span className="stat-l">Cần ôn</span>
        </Link>
      </section>

      {/* Học tiếp: chính video của ký hiệu sắp học là ảnh minh hoạ */}
      {current && nextWord && (
        <section className="next" aria-label="Học tiếp">
          <div className="next-vid">
            <LoopVideo word={nextWord} style={{ position: "absolute", inset: 0, borderRadius: 0, background: "transparent" }} />
            <div className="next-word">
              <span className="eyebrow" style={{ color: "rgba(255,255,255,.75)" }}>
                Ký hiệu tiếp theo
              </span>
              <div className="d4" style={{ color: "#fff" }}>
                {nextWord}
              </div>
            </div>
          </div>
          <div className="next-body">
            <div className="col col--tight">
              <span className="bb">
                Chặng {curIdx + 1} · {current.title}
              </span>
              <span className="sm num" style={{ color: "rgba(255,255,255,.75)" }}>
                Đã thuộc {curDone}/{current.words.length} ký hiệu
              </span>
            </div>
            <Dots words={current.words} learned={learned} dark />
            <Btn href={practiceUrl(nextWord, current.id)} level="tertiary" icon={Play}>
              Học “{nextWord}”
            </Btn>
          </div>
        </section>
      )}

      <div className="row row--between" style={{ marginTop: 4 }}>
        <h2 className="h4">Các chặng</h2>
        <span className="sm num">
          {countLearned(progress, labels)}/{labels.length} ký hiệu
        </span>
      </div>
      {loading && [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 64 }} />)}
      {!loading && labels.length === 0 && <div className="card">Chưa có dữ liệu từ (labels.json).</div>}

      <ol className="path" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {lessons.map((l, i) => {
          const done = countLearned(progress, l.words);
          const complete = done === l.words.length;
          const isCurrent = l.id === current?.id;
          return (
            <li key={l.id}>
              <Link href={lessonUrl(l.id)} className={`step ${complete ? "step--done" : isCurrent ? "step--cur" : ""}`}>
                <span className="step-n" aria-hidden>
                  {complete ? <Check size={22} strokeWidth={3} /> : i + 1}
                </span>
                <span className="step-body">
                  <span className="row" style={{ gap: 8 }}>
                    <span className="bb" style={{ flex: 1 }}>
                      {l.title}
                    </span>
                    <span className="sm num" style={{ flex: "none" }}>
                      {done}/{l.words.length}
                    </span>
                  </span>
                  <Dots words={l.words} learned={learned} />
                </span>
                <ChevronRight size={20} color="var(--txt3)" aria-hidden />
              </Link>
            </li>
          );
        })}
        <li>
          <Link href="/cau" className="step">
            <span className="step-n" aria-hidden style={{ borderStyle: "dashed" }}>
              <MessageCircle size={20} />
            </span>
            <span className="step-body">
              <span className="bb">Câu giao tiếp</span>
              <span className="sm">59 câu: chào hỏi, đi khám, mua sắm…</span>
            </span>
            <ChevronRight size={20} color="var(--txt3)" aria-hidden />
          </Link>
        </li>
      </ol>
      <BottomNav />
    </main>
  );
}
