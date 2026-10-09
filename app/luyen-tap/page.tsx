"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Layers, Shuffle, Camera, ChevronRight, Languages, MessageCircle, RotateCcw } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Bar, Btn } from "@/components/ui";
import { useLabels } from "@/lib/useLabels";
import { useProgress } from "@/lib/useProgress";
import { dueWords, dayStreak } from "@/lib/progress";
import { practiceUrl } from "@/lib/nav";

const MODES = [
  { href: "/the-ghi-nho", icon: Layers, title: "Thẻ ghi nhớ", sub: "Nhìn chữ, nhớ ký hiệu, lật thẻ tự chấm", tone: "var(--yel-soft)", fg: "var(--yel-txt)" },
  { href: "/quiz", icon: Shuffle, title: "Đố nhanh", sub: "8 từ ngẫu nhiên, camera chấm từng từ", tone: "var(--pnk-soft)", fg: "var(--pnk-txt)" },
  { href: "/tu-dien", icon: Camera, title: "Luyện tự do", sub: "Chọn bất kỳ từ nào trong từ điển", tone: "var(--grn-soft)", fg: "var(--grn-txt)" },
  { href: "/cau", icon: MessageCircle, title: "Câu giao tiếp", sub: "60 câu ký liền mạch", tone: "var(--pur-soft)", fg: "var(--pur-txt)" },
  { href: "/dich", icon: Languages, title: "Dịch ký hiệu", sub: "Ký liên tục, app hiện chữ và đọc to · thử nghiệm", tone: "var(--blu-soft)", fg: "var(--blu-txt)" },
];

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
        .slice(0, 5),
    [progress, labels]
  );

  return (
    <main className="app app--nav">
      <header className="col col--tight">
        <span className="bm">Ôn đúng lúc để nhớ lâu</span>
        <h1 className="h1">Luyện tập</h1>
      </header>

      <div className="split">
        {/* Ôn tập đến hạn: hiện luôn các từ, không cần đoán */}
        <section className="card" style={{ gap: 14, padding: 20 }}>
          <span className="eyebrow">Đến hạn hôm nay</span>
          <div className="row" style={{ alignItems: "baseline", gap: 10 }}>
            <span className="d3 num">{due.length}</span>
            <span className="bb muted">{due.length ? `từ · khoảng ${Math.max(1, Math.round(due.length * 0.5))} phút` : "từ"}</span>
          </div>
          {due.length ? (
            <div className="row wrap" style={{ gap: 6 }}>
              {due.slice(0, 8).map((w) => (
                <span key={w} className="pill" style={{ background: "var(--sunk)", color: "var(--txt)" }}>
                  {w}
                </span>
              ))}
              {due.length > 8 && <span className="pill faint">+{due.length - 8}</span>}
            </div>
          ) : (
            <p className="bm" style={{ margin: 0 }}>
              Chưa có từ nào đến hạn. Từ bạn ký đúng sẽ quay lại đây sau 8 giờ, rồi 1 ngày, 3 ngày, 1 tuần.
            </p>
          )}
          <Btn href="/quiz?mode=review" disabled={!due.length} icon={RotateCcw}>
            Ôn ngay
          </Btn>
        </section>

        <section className="col">
          <h2 className="h4">Chế độ luyện</h2>
          <nav className="rows" aria-label="Chế độ luyện">
            {MODES.map(({ href, icon: I, title, sub, tone, fg }) => (
              <Link key={href} href={href}>
                <span className="glyph" style={{ background: tone, color: fg }}>
                  <I size={22} aria-hidden />
                </span>
                <span className="col col--tight grow" style={{ minWidth: 0 }}>
                  <span className="bb">{title}</span>
                  <span className="sm">{sub}</span>
                </span>
                <ChevronRight size={20} color="var(--txt3)" aria-hidden />
              </Link>
            ))}
          </nav>
        </section>
      </div>

      <section className="col">
        <div className="row row--between">
          <h2 className="h4">Từ hay sai</h2>
          <span className="sm num">Kỷ lục {progress.bestStreak} lần đúng liền · {dayStreak(progress)} ngày</span>
        </div>
        {weak.length === 0 ? (
          <p className="bm" style={{ margin: 0 }}>
            Chưa có. Từ nào bạn ký đúng dưới 70% sẽ hiện ở đây để luyện lại.
          </p>
        ) : (
          <div className="rows">
            {weak.map(([w, s]) => {
              const pct = Math.round((s.correct / s.attempts) * 100);
              return (
                <Link key={w} href={practiceUrl(w)}>
                  <span className="col col--tight grow">
                    <span className="row row--between">
                      <span className="bb">{w}</span>
                      <span className="sm num">
                        {s.correct}/{s.attempts} đúng
                      </span>
                    </span>
                    <Bar pct={pct} h={6} color={pct < 40 ? "var(--red)" : "var(--yel)"} />
                  </span>
                  <ChevronRight size={20} color="var(--txt3)" aria-hidden />
                </Link>
              );
            })}
          </div>
        )}
      </section>
      <BottomNav />
    </main>
  );
}
