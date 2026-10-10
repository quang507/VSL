"use client";

import { asset } from "@/lib/base";
import { useMemo } from "react";
import Link from "next/link";
import { Zap, CheckCircle2, Bookmark, Star, Lock, Trophy, Flame, Sprout, BookOpen, GraduationCap, Gem, Target, Flag, ArrowRight, Aperture, Settings } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Bar } from "@/components/ui";
import { useLabels } from "@/lib/useLabels";
import { useProgress } from "@/lib/useProgress";
import { useProfile, REGIONS } from "@/lib/profile";
import { useSaved } from "@/lib/saved";
import { countLearned, dayKey, dayStreak, levelInfo } from "@/lib/progress";
import { BADGES, earnedBadgeIds } from "@/lib/badges";

// Huy hiệu: icon + nền (Figma: vòng tròn 56px tông soft)
const BADGE_ICON: Record<string, [typeof Star, string, string]> = {
  first: [Sprout, "var(--grn-soft)", "var(--grn-txt)"],
  words10: [BookOpen, "var(--brand-soft)", "var(--blu-txt)"],
  words25: [GraduationCap, "var(--pur-soft)", "var(--pur-txt)"],
  words50: [Trophy, "var(--yel-soft)", "var(--yel-txt)"],
  streak3: [Flame, "var(--org-soft)", "var(--org-txt)"],
  streak7: [Zap, "var(--yel-soft)", "var(--yel-txt)"],
  streak30: [Gem, "var(--cya-soft)", "var(--cya-txt)"],
  combo10: [Target, "var(--red-soft)", "var(--red-txt)"],
  level5: [Star, "var(--grn-soft)", "var(--grn-txt)"],
};
const LEVEL_NAME = ["Người mới", "Người tập ký", "Người chăm chỉ", "Người kết nối", "Người truyền cảm hứng"];
const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** Figma · Tra từ điển · "10 Profile" (358:7793) */
export default function ProfilePage() {
  const { labels } = useLabels();
  const [progress] = useProgress();
  const { profile } = useProfile();
  const { saved } = useSaved();
  const learned = countLearned(progress, labels);
  const lvl = levelInfo(progress.score);
  const earned = useMemo(() => earnedBadgeIds(progress, learned), [progress, learned]);
  const region = REGIONS.find((r) => r.id === profile.region);

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
  const H = 110;

  return (
    <main className="app app--nav" style={{ gap: 16 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="deco-cloud" src={asset("/img/figma/cloud.webp")} alt="" style={{ width: 130 }} />

      <header className="row" style={{ gap: 16, marginTop: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/img/figma/avatar.webp")} alt="" style={{ width: 76, height: 76, borderRadius: 999, objectFit: "cover", flex: "none" }} />
        <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
          <h1 className="h1">{profile.name || "Bạn"}</h1>
          <span className="badge badge--s badge--acc">
            Cấp {lvl.level} · {LEVEL_NAME[Math.min(lvl.level, LEVEL_NAME.length) - 1]}
          </span>
        </div>
      </header>

      <div className="col" style={{ gap: 6 }}>
        <div className="row row--between t-sub">
          <span>Lên cấp {lvl.level + 1}</span>
          <span className="num">
            {lvl.into}/{lvl.size} XP
          </span>
        </div>
        <Bar pct={lvl.pct} color="var(--yel)" h={8} />
      </div>

      <section className="stat-tiles" aria-label="Thống kê">
        <div className="stat-tile" style={{ background: "var(--yel-soft)" }}>
          <Zap size={22} fill="var(--org)" color="var(--org)" aria-hidden />
          <span className="h4 num">{dayStreak(progress)} ngày</span>
          <span className="t-sub" style={{ fontWeight: 600 }}>
            Chuỗi học
          </span>
        </div>
        <div className="stat-tile" style={{ background: "var(--grn-soft)" }}>
          <CheckCircle2 size={22} fill="var(--pos)" color="#fff" aria-hidden />
          <span className="h4 num">{learned} từ</span>
          <span className="t-sub" style={{ fontWeight: 600 }}>
            Đã thuộc
          </span>
        </div>
        <Link href="/tu-dien" className="stat-tile" style={{ background: "var(--brand-soft)" }}>
          <Bookmark size={22} fill="var(--acc)" color="var(--acc)" aria-hidden />
          <span className="h4 num">{saved.length} từ</span>
          <span className="t-sub" style={{ fontWeight: 600 }}>
            Đã lưu
          </span>
        </Link>
      </section>

      <div className="row row--between" style={{ marginTop: 8 }}>
        <h2 className="sub">Thành tích</h2>
        <span className="t-sub num" style={{ color: "var(--acc)", fontWeight: 600 }}>
          {earned.size}/{BADGES.length}
        </span>
      </div>
      <section className="ach" aria-label="Huy hiệu">
        {BADGES.map((b) => {
          const got = earned.has(b.id);
          const [I, bg, fg] = BADGE_ICON[b.id] ?? [Star, "var(--brand-soft)", "var(--acc)"];
          return (
            <div key={b.id} title={b.desc}>
              <span className="ach-ic" style={{ background: got ? bg : "var(--sunk)", color: got ? fg : "var(--txt3)" }}>
                {got ? <I size={26} aria-hidden /> : <Lock size={22} aria-hidden />}
              </span>
              <span className="t-sub" style={{ fontWeight: 600, color: got ? "var(--txt)" : "var(--txt3)" }}>
                {b.title}
              </span>
              <span className="sr-only">{got ? "Đã đạt" : `Chưa đạt: ${b.desc}`}</span>
            </div>
          );
        })}
      </section>

      <h2 className="sub" style={{ marginTop: 8 }}>
        Thiết lập
      </h2>
      <nav className="setlist" aria-label="Thiết lập">
        <Link href="/cai-dat">
          <Flag size={22} aria-hidden />
          <span className="grow">Vùng ký hiệu</span>
          <span className="t-sub" style={{ fontSize: 14, fontWeight: 500 }}>
            {region?.name ?? "Toàn quốc"}
          </span>
          <ArrowRight size={20} aria-hidden />
        </Link>
        <Link href="/cai-dat">
          <Target size={22} aria-hidden />
          <span className="grow">Mục tiêu mỗi ngày</span>
          <span className="t-sub" style={{ fontSize: 14, fontWeight: 500 }}>
            {goal} lần
          </span>
          <ArrowRight size={20} aria-hidden />
        </Link>
        <Link href="/quyen-rieng-tu">
          <Aperture size={22} aria-hidden />
          <span className="grow">Camera &amp; quyền riêng tư</span>
          <ArrowRight size={20} aria-hidden />
        </Link>
        <Link href="/cai-dat">
          <Settings size={22} aria-hidden />
          <span className="grow">Cài đặt khác</span>
          <ArrowRight size={20} aria-hidden />
        </Link>
      </nav>

      <section className="card" style={{ marginTop: 8, padding: 18 }} aria-label="Hoạt động 7 ngày">
        <div className="row row--between">
          <span className="sub">Hoạt động 7 ngày</span>
          <span className="t-sub">Mục tiêu {goal}/ngày</span>
        </div>
        <div style={{ position: "relative", height: H + 24 }} role="img" aria-label={`Số lần ký đúng 7 ngày: ${week.map((w) => `${w.label} ${w.n}`).join(", ")}`}>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 24 + (goal / max) * H, borderTop: "2px dashed var(--yel)" }} />
          <div className="row" style={{ position: "absolute", inset: 0, alignItems: "flex-end", gap: 8 }}>
            {week.map((w, i) => (
              <div key={i} className="col col--tight grow" style={{ alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                <span className="t-sub num">{w.n || ""}</span>
                <span style={{ width: "100%", maxWidth: 32, height: Math.max(4, (w.n / max) * H), borderRadius: 8, background: w.n >= goal ? "var(--grn)" : w.today ? "var(--brand)" : w.n ? "var(--brand-soft)" : "var(--sunk)" }} />
                <span className="t-sub" style={{ fontWeight: w.today ? 700 : 500, color: w.today ? "var(--acc)" : undefined }}>
                  {w.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <BottomNav />
    </main>
  );
}
