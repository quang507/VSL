"use client";

import { useMemo } from "react";
import { Settings, Zap, CheckCircle2, Star, Lock, Trophy, Flame, Sprout, BookOpen, GraduationCap, Gem, Target, Award } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Bar, IconBtn, Pill, SectionTitle } from "@/components/ui";
import { useLabels } from "@/lib/useLabels";
import { useProgress } from "@/lib/useProgress";
import { useProfile } from "@/lib/profile";
import { countLearned, dayKey, dayStreak, levelInfo } from "@/lib/progress";
import { BADGES, earnedBadgeIds } from "@/lib/badges";
import { buildLessons } from "@/lib/lessons";

const BADGE_ICON: Record<string, [typeof Star, string]> = {
  first: [Sprout, "var(--grn)"],
  words10: [BookOpen, "var(--brand)"],
  words25: [GraduationCap, "var(--pur)"],
  words50: [Trophy, "var(--yel)"],
  streak3: [Flame, "var(--org)"],
  streak7: [Zap, "var(--org)"],
  streak30: [Gem, "var(--cya)"],
  combo10: [Target, "var(--red)"],
  level5: [Star, "var(--yel)"],
};

const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export default function ProfilePage() {
  const { labels } = useLabels();
  const [progress] = useProgress();
  const { profile } = useProfile();
  const learned = countLearned(progress, labels);
  const lvl = levelInfo(progress.score);
  const earned = useMemo(() => earnedBadgeIds(progress, learned), [progress, learned]);
  const lessons = useMemo(() => buildLessons(labels), [labels]);

  // 7 ngày gần nhất
  const week = useMemo(() => {
    const out: { label: string; n: number; today: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push({ label: DOW[d.getDay()], n: progress.days[dayKey(d)] ?? 0, today: i === 0 });
    }
    return out;
  }, [progress]);
  const max = Math.max(progress.dailyGoal, ...week.map((w) => w.n));

  // Độ chính xác theo chủ đề
  const acc = lessons
    .map((l) => {
      let a = 0,
        c = 0;
      for (const w of l.words) {
        a += progress.words[w]?.attempts ?? 0;
        c += progress.words[w]?.correct ?? 0;
      }
      return { title: l.title, pct: a ? Math.round((c / a) * 100) : -1 };
    })
    .filter((x) => x.pct >= 0);

  return (
    <main className="app app--nav" style={{ gap: 22 }}>
      <div className="row">
        <div className="sticker" style={{ width: 76, height: 76 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/mascot_peace.png" alt="" style={{ width: "86%" }} />
        </div>
        <div className="col col--tight grow">
          <h1 className="h2">{profile.name || "Bạn"}</h1>
          <Pill>
            Cấp {lvl.level} · {progress.score} XP
          </Pill>
        </div>
        <IconBtn icon={Settings} label="Cài đặt" href="/cai-dat" />
      </div>

      <div className="col col--tight">
        <div className="row row--between">
          <span className="sm">Lên cấp {lvl.level + 1}</span>
          <span className="sm">
            {lvl.into}/{lvl.size} XP
          </span>
        </div>
        <Bar pct={lvl.pct} color="var(--yel)" h={12} />
      </div>

      <div className="row" style={{ gap: 12, alignItems: "stretch" }}>
        {(
          [
            [Zap, `${dayStreak(progress)}`, "ngày liên tiếp", "t-yel"],
            [CheckCircle2, `${learned}`, "từ đã thuộc", "t-grn"],
            [Award, `${earned.size}/${BADGES.length}`, "huy hiệu", "t-blu"],
          ] as const
        ).map(([I, v, l, t]) => (
          <div key={l} className={`tile ${t}`} style={{ flex: 1, gap: 4 }}>
            <I size={22} className="tone-txt" aria-hidden />
            <span className="h2">{v}</span>
            <span className="sm">{l}</span>
          </div>
        ))}
      </div>

      <section className="card">
        <div className="row row--between">
          <span className="bb">Lần ký đúng 7 ngày qua</span>
          <Pill bg="var(--neu)" fg="var(--txt2)" icon={Target}>
            Mục tiêu {progress.dailyGoal}
          </Pill>
        </div>
        <div className="row" style={{ alignItems: "flex-end", height: 140, gap: 10 }}>
          {week.map((w, i) => (
            <div key={i} className="col col--tight grow" style={{ alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
              <span className="sm" style={{ color: w.today ? "var(--acc)" : undefined }}>
                {w.n || ""}
              </span>
              <span
                style={{
                  width: "100%",
                  height: `${Math.max(6, (w.n / max) * 90)}px`,
                  borderRadius: 10,
                  background: w.today ? "var(--brand)" : w.n >= progress.dailyGoal ? "var(--brand-bd)" : "var(--neu)",
                }}
              />
              <span className="sm" style={{ color: w.today ? "var(--acc)" : "var(--txt3)" }}>
                {w.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {acc.length > 0 && (
        <section className="card">
          <span className="bb">Độ chính xác theo chủ đề</span>
          {acc.map((a) => (
            <div key={a.title} className="col col--tight">
              <div className="row row--between">
                <span className="bm" style={{ color: "var(--txt)" }}>
                  {a.title}
                </span>
                <span className="bb">{a.pct}%</span>
              </div>
              <Bar pct={a.pct} h={8} color={a.pct >= 80 ? "var(--grn)" : a.pct >= 50 ? "var(--yel)" : "var(--red)"} />
            </div>
          ))}
        </section>
      )}

      <SectionTitle>Huy hiệu</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {BADGES.map((b) => {
          const got = earned.has(b.id);
          const [I, c] = BADGE_ICON[b.id] ?? [Star, "var(--brand)"];
          return (
            <div key={b.id} className="card" style={{ alignItems: "center", textAlign: "center", padding: "14px 8px", gap: 8 }}>
              <span className="icon-circle" style={{ width: 64, height: 64, background: got ? c : "var(--neu)", color: got ? "#fff" : "var(--txt3)", boxShadow: got ? `0 0 0 5px color-mix(in srgb, ${c} 30%, transparent)` : undefined }}>
                {got ? <I size={30} aria-hidden /> : <Lock size={26} aria-hidden />}
              </span>
              <span className="bb" style={{ fontSize: 14 }}>
                {b.title}
              </span>
              <span className="sm" style={{ fontSize: 12 }}>
                {b.desc}
              </span>
            </div>
          );
        })}
      </div>
      <BottomNav />
    </main>
  );
}
