"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Layers, Shuffle, RotateCcw, Camera, ChevronRight } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Bar, Btn, IconCircle, SectionTitle, Sticker } from "@/components/ui";
import { useLabels } from "@/lib/useLabels";
import { useProgress } from "@/lib/useProgress";
import { dueWords, dayStreak } from "@/lib/progress";
import { practiceUrl } from "@/lib/nav";

export default function PracticeHub() {
  const { labels } = useLabels();
  const [progress] = useProgress();
  const due = useMemo(() => dueWords(progress, labels), [progress, labels]);

  // Từ yếu: đã luyện nhưng tỉ lệ đúng thấp nhất
  const weak = useMemo(
    () =>
      Object.entries(progress.words)
        .filter(([w, s]) => labels.includes(w) && s.attempts > 0 && s.correct / s.attempts < 0.7)
        .sort((a, b) => a[1].correct / a[1].attempts - b[1].correct / b[1].attempts)
        .slice(0, 4),
    [progress, labels]
  );

  return (
    <main className="app app--nav" style={{ gap: 22 }}>
      <div className="col col--tight">
        <span className="bm">Ôn đều mỗi ngày để nhớ lâu</span>
        <h1 className="h1">Luyện tập</h1>
      </div>

      <section className="hero hero--deep">
        <div className="col" style={{ flex: 1, gap: 6 }}>
          <span className="bb" style={{ opacity: 0.85 }}>
            Đến hạn hôm nay
          </span>
          <div className="row" style={{ gap: 10 }}>
            <span className="d1" style={{ color: "#fff" }}>
              {due.length}
            </span>
            <span className="h4" style={{ color: "#fff" }}>
              từ cần
              <br />
              ôn lại
            </span>
          </div>
          <span className="bm" style={{ color: "rgba(255,255,255,.85)" }}>
            {due.length ? `Khoảng ${Math.max(1, Math.round(due.length * 0.5))} phút` : "Chưa có từ nào đến hạn"}
          </span>
          <div style={{ marginTop: 6 }}>
            <Btn href="/quiz?mode=review" level="tertiary" size="md" block={false} disabled={!due.length}>
              Ôn ngay
            </Btn>
          </div>
        </div>
        <Sticker src="/img/mascot_cheer.png" size={112} />
      </section>

      <SectionTitle>Chế độ luyện</SectionTitle>
      <div className="grid2">
        <Link href="/the-ghi-nho" className="tile t-yel" style={{ gridRow: "span 2", justifyContent: "space-between", minHeight: 200 }}>
          <IconCircle icon={Layers} size={48} bg="var(--surface)" fg="var(--yel-txt)" />
          <span className="col col--tight">
            <span className="h4">Thẻ ghi nhớ</span>
            <span className="sm">Nhìn từ, nhớ ký hiệu, lật thẻ tự chấm</span>
          </span>
          <span className="bb tone-txt row" style={{ gap: 4 }}>
            Bắt đầu <ChevronRight size={18} aria-hidden />
          </span>
        </Link>
        <Link href="/quiz" className="tile t-pnk" style={{ flexDirection: "row", alignItems: "center" }}>
          <IconCircle icon={Shuffle} size={40} bg="var(--surface)" fg="var(--pnk-txt)" />
          <span className="col col--tight">
            <span className="bb">Đố vui</span>
            <span className="sm">8 từ ngẫu nhiên</span>
          </span>
        </Link>
        <Link href="/tu-dien" className="tile t-grn" style={{ flexDirection: "row", alignItems: "center" }}>
          <IconCircle icon={Camera} size={40} bg="var(--surface)" fg="var(--grn-txt)" />
          <span className="col col--tight">
            <span className="bb">Luyện tự do</span>
            <span className="sm">Chọn từ bất kỳ</span>
          </span>
        </Link>
      </div>

      <SectionTitle>Từ yếu cần luyện</SectionTitle>
      {weak.length === 0 ? (
        <div className="card card--row">
          <IconCircle icon={RotateCcw} bg="var(--grn-soft)" fg="var(--grn-txt)" />
          <span className="bm">Chưa có từ yếu. Từ nào bạn ký sai nhiều sẽ hiện ở đây.</span>
        </div>
      ) : (
        <div className="card card--list">
          {weak.map(([w, s]) => {
            const pct = Math.round((s.correct / s.attempts) * 100);
            return (
              <Link key={w} href={practiceUrl(w)} className="list-row">
                <span className="col col--tight grow">
                  <span className="bb">{w}</span>
                  <span className="sm">
                    Đúng {s.correct}/{s.attempts} lần
                  </span>
                  <Bar pct={pct} h={6} color={pct < 40 ? "var(--red)" : "var(--yel)"} />
                </span>
                <span className="icon-circle" style={{ width: 44, height: 44, background: "var(--brand-soft)", color: "var(--acc)" }} aria-label="Luyện lại">
                  <RotateCcw size={22} aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <section className="tile t-org" style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/target.png" alt="" style={{ width: 56, height: 56 }} />
        <span className="col col--tight grow">
          <span className="sm tone-txt">Kỷ lục combo</span>
          <span className="bb">
            {progress.bestStreak} lần đúng liên tiếp · chuỗi {dayStreak(progress)} ngày
          </span>
        </span>
      </section>
      <BottomNav />
    </main>
  );
}
