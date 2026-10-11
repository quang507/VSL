"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ChevronRight, PlayCircle } from "lucide-react";
import { Bar, Btn, TopBar } from "@/components/ui";
import { findLesson } from "@/lib/lessons";
import { useLabels } from "@/lib/useLabels";
import { useProgress } from "@/lib/useProgress";
import { practiceUrl } from "@/lib/nav";
import { isLearned, countLearned } from "@/lib/progress";
import { TONE, lessonIcon } from "@/lib/theme";

function LessonInner() {
  const id = useSearchParams().get("id") ?? "";
  const { labels, loading } = useLabels();
  const [progress] = useProgress();
  const lesson = useMemo(() => findLesson(labels, id), [labels, id]);

  if (loading)
    return (
      <main className="app">
        <TopBar title="Bài học" back="/" />
        <div className="skeleton" style={{ height: 180, borderRadius: 28 }} />
      </main>
    );

  if (!lesson)
    return (
      <main className="app">
        <TopBar title="Bài học" back="/" />
        <div className="card">Không tìm thấy bài học này.</div>
      </main>
    );

  const done = countLearned(progress, lesson.words);
  const firstTodo = lesson.words.find((w) => !isLearned(progress, w)) ?? lesson.words[0];
  const Icon = lessonIcon(lesson.id);

  return (
    <main className="app">
      <TopBar title={lesson.title} back="/" />
      <section className={`tile ${TONE[lesson.color]}`} style={{ padding: 20, gap: 12 }}>
        <div className="row">
          <span className="icon-circle" style={{ width: 64, height: 64, background: "var(--surface)", boxShadow: "var(--shadow-soft)" }}>
            <Icon size={32} className="tone-txt" aria-hidden />
          </span>
          <div className="col col--tight grow">
            <span className="sm tone-txt">{lesson.words.length} ký hiệu</span>
            <span className="h3">{lesson.title}</span>
          </div>
        </div>
        <div className="row">
          <Bar pct={(done / lesson.words.length) * 100} color="var(--tone)" track="rgba(255,255,255,.6)" />
          <span className="bb" style={{ flex: "none" }}>
            {done}/{lesson.words.length}
          </span>
        </div>
      </section>

      <Btn href={practiceUrl(firstTodo, lesson.id)} icon={PlayCircle}>
        {done === 0 ? "Bắt đầu bài học" : done === lesson.words.length ? "Ôn lại cả bài" : "Học tiếp"}
      </Btn>

      <div className="card card--list">
        {lesson.words.map((w, i) => {
          const learned = isLearned(progress, w);
          const stat = progress.words[w];
          return (
            <Link key={w} href={practiceUrl(w, lesson.id)} className="list-row" style={{ minHeight: 64 }}>
              <span className="icon-circle" style={{ width: 36, height: 36, background: learned ? "var(--grn)" : "var(--neu)", color: learned ? "#fff" : "var(--txt2)", fontWeight: 700 }}>
                {learned ? <CheckCircle2 size={20} aria-hidden /> : i + 1}
              </span>
              <span className="col col--tight grow">
                <span className="bb">{w}</span>
                <span className="sm">{stat ? `Đúng ${stat.correct}/${stat.attempts} lần` : "Chưa luyện"}</span>
              </span>
              <ChevronRight size={20} color="var(--txt3)" aria-hidden />
            </Link>
          );
        })}
      </div>
    </main>
  );
}

export default function LessonPage() {
  return (
    <Suspense fallback={<main className="app">Đang tải…</main>}>
      <LessonInner />
    </Suspense>
  );
}
