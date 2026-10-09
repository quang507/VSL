"use client";

import { useMemo } from "react";
import { Settings, Zap, Star, Lock, Trophy, Flame, Sprout, BookOpen, GraduationCap, Gem, Target } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Bar, IconBtn } from "@/components/ui";
import { useLabels } from "@/lib/useLabels";
import { useProgress } from "@/lib/useProgress";
import { useProfile, REGIONS } from "@/lib/profile";
import { countLearned, dayKey, dayStreak, levelInfo } from "@/lib/progress";
import { BADGES, earnedBadgeIds } from "@/lib/badges";
import { buildLessons } from "@/lib/lessons";

const BADGE_ICON: Record<string, [typeof Star, string]> = {
  first: [Sprout, "var(--grn)"],
  words10: [BookOpen, "var(--brand)"],
  words25: [GraduationCap, "var(--pur)"],
  words50: [Trophy, "var(--org)"],
  streak3: [Flame, "var(--org)"],
  streak7: [Zap, "var(--org)"],
  streak30: [Gem, "var(--cya)"],
  combo10: [Target, "var(--red)"],
  level5: [Star, "var(--org)"],
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
  const region = REGIONS.find((r) => r.id === profile.region);
  const name = profile.name || "Bạn";

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
  const goal = progress.dailyGoal;
  const max = Math.max(goal * 1.25, ...week.map((w) => w.n));
  const weekTotal = week.reduce((a, w) => a + w.n, 0);
  const H = 120;

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
    <main className="app app--nav">
      <header className="row" style={{ gap: 14 }}>
        <span
          className="icon-circle"
          aria-hidden
          style={{ width: 64, height: 64, background: "var(--brand-deep)", color: "#fff", fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600 }}
        >
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="col col--tight grow" style={{ minWidth: 0 }}>
          <h1 className="h2">{name}</h1>
          <span className="sm">
            Cấp {lvl.level} · {region?.name ?? "Toàn quốc"}
          </span>
        </div>
        <IconBtn icon={Settings} label="Cài đặt" href="/cai-dat" />
      </header>

      <div className="col col--tight">
        <div className="row row--between">
          <span className="sm">Lên cấp {lvl.level + 1}</span>
          <span className="sm num">
            {lvl.into}/{lvl.size} XP
          </span>
        </div>
        <Bar pct={lvl.pct} color="var(--yel)" h={10} />
      </div>

      <section className="stats" aria-label="Thành tích">
        <div>
          <span className="stat-v">{dayStreak(progress)}</span>
          <span className="stat-l">Ngày liên tiếp</span>
        </div>
        <div>
          <span className="stat-v">
            {learned}
            <span className="faint">/{labels.length}</span>
          </span>
          <span className="stat-l">Từ đã thuộc</span>
        </div>
        <div>
          <span className="stat-v">{progress.score}</span>
          <span className="stat-l">XP</span>
        </div>
      </section>

      <div className="split">
        <section className="card" style={{ padding: 18 }}>
          <div className="row row--between">
            <div className="col col--tight">
              <span className="eyebrow">7 ngày qua</span>
              <span className="h4 num">{weekTotal} lần ký đúng</span>
            </div>
            <span className="sm">Mục tiêu {goal}/ngày</span>
          </div>
          <div style={{ position: "relative", height: H + 24, marginTop: 8 }} role="img" aria-label={`Số lần ký đúng 7 ngày: ${week.map((w) => `${w.label} ${w.n}`).join(", ")}`}>
            {/* vạch mục tiêu */}
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 24 + (goal / max) * H, borderTop: "2px dashed var(--yel)" }} />
            <div className="row" style={{ position: "absolute", inset: 0, alignItems: "flex-end", gap: 8 }}>
              {week.map((w, i) => (
                <div key={i} className="col col--tight grow" style={{ alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                  <span className="sm num" style={{ fontSize: 12, color: w.today ? "var(--acc)" : "var(--txt3)" }}>
                    {w.n || ""}
                  </span>
                  <span
                    style={{
                      width: "100%",
                      maxWidth: 36,
                      height: Math.max(4, (w.n / max) * H),
                      borderRadius: 6,
                      background: w.n >= goal ? "var(--grn)" : w.today ? "var(--brand)" : w.n ? "rgba(22,24,29,.25)" : "var(--neu)",
                    }}
                  />
                  <span className="sm" style={{ fontSize: 12, color: w.today ? "var(--txt)" : "var(--txt3)", fontWeight: w.today ? 800 : 600 }}>
                    {w.label}
                  </span>
                </div>
              ))}
            </div>
            {weekTotal === 0 && (
              <div className="center" style={{ position: "absolute", left: 0, right: 0, top: 30 }}>
                <span className="sm">Ký đúng lần đầu để bắt đầu biểu đồ</span>
              </div>
            )}
          </div>
        </section>

        {acc.length > 0 ? (
          <section className="card" style={{ padding: 18 }}>
            <span className="eyebrow">Độ chính xác theo chủ đề</span>
            {acc.map((a) => (
              <div key={a.title} className="col col--tight">
                <div className="row row--between">
                  <span className="bm" style={{ color: "var(--txt)" }}>
                    {a.title}
                  </span>
                  <span className="bb num">{a.pct}%</span>
                </div>
                <Bar pct={a.pct} h={6} color={a.pct >= 80 ? "var(--grn)" : a.pct >= 50 ? "var(--yel)" : "var(--red)"} />
              </div>
            ))}
          </section>
        ) : (
          <div />
        )}
      </div>

      <div className="row row--between">
        <h2 className="h4">Huy hiệu</h2>
        <span className="sm num">
          {earned.size}/{BADGES.length}
        </span>
      </div>
      <div className="rows" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", padding: 8, gap: 0 }}>
        {BADGES.map((b) => {
          const got = earned.has(b.id);
          const [I, c] = BADGE_ICON[b.id] ?? [Star, "var(--brand)"];
          return (
            <div key={b.id} className="col" style={{ alignItems: "center", textAlign: "center", padding: "12px 4px", gap: 6, border: "none", minHeight: 0 }}>
              <span className="icon-circle" style={{ width: 52, height: 52, background: got ? c : "var(--sunk)", color: got ? "#fff" : "var(--txt3)" }}>
                {got ? <I size={26} aria-hidden /> : <Lock size={20} aria-hidden />}
              </span>
              <span className="bb" style={{ fontSize: 14, color: got ? undefined : "var(--txt2)" }}>
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
