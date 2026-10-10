"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Copy, ArrowRight, Camera, ChevronRight, Languages, RotateCcw, Zap } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Btn } from "@/components/ui";
import { useLabels } from "@/lib/useLabels";
import { useProgress } from "@/lib/useProgress";
import { dueWords, dayStreak } from "@/lib/progress";
import { practiceUrl } from "@/lib/nav";
import { thumbUrl } from "@/lib/theme";

const today = () =>
  new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" }).replace(/^./, (c) => c.toUpperCase());

/** Figma · Luyện tập & Ôn tập · "01 Luyện tập" (2010:7352) */
export default function PracticeHub() {
  const { labels } = useLabels();
  const [progress] = useProgress();
  const due = useMemo(() => dueWords(progress, labels), [progress, labels]);
  const learnedCount = useMemo(() => Object.values(progress.words).filter((s) => s.correct > 0).length, [progress]);

  // Từ yếu: đã luyện nhưng tỉ lệ đúng thấp nhất
  const weak = useMemo(
    () =>
      Object.entries(progress.words)
        .filter(([w, s]) => labels.includes(w) && s.attempts > 0 && s.correct / s.attempts < 0.7)
        .sort((a, b) => a[1].correct / a[1].attempts - b[1].correct / b[1].attempts)
        .slice(0, 4),
    [progress, labels]
  );
  const combo = Math.min(progress.bestStreak, 10);

  return (
    <main className="app app--nav" style={{ gap: 24 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="deco-cloud" src="/img/figma/cloud.webp" alt="" style={{ width: 130 }} />
      <header className="row row--between">
        <div className="col" style={{ gap: 0 }}>
          <span className="bm" style={{ fontSize: 14 }}>
            {today()}
          </span>
          <h1 className="h1" style={{ color: "var(--txt)" }}>
            Luyện tập
          </h1>
        </div>
        <Link href="/ho-so" className="pill" style={{ background: "var(--surface)", boxShadow: "var(--shadow-tile)", padding: "8px 14px 8px 10px", minHeight: 44, fontSize: 14 }} aria-label={`Chuỗi ${dayStreak(progress)} ngày`}>
          <Zap size={22} color="var(--org)" fill="var(--org)" aria-hidden />
          {dayStreak(progress)} ngày
        </Link>
      </header>

      {/* Đến hạn hôm nay */}
      <section className="hero hero--deep" style={{ borderRadius: 28, padding: "22px 20px 22px 22px" }} aria-label="Từ đến hạn ôn">
        <div className="col grow" style={{ gap: 8, minWidth: 0 }}>
          <span className="bb" style={{ fontSize: 14 }}>
            Đến hạn hôm nay
          </span>
          <div className="row" style={{ gap: 10 }}>
            <span className="d1 num" style={{ color: "#fff" }}>
              {due.length}
            </span>
            <span className="h4" style={{ color: "#fff" }}>
              từ cần
              <br />
              ôn lại
            </span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 500 }}>
            {due.length ? `Khoảng ${Math.max(1, Math.round(due.length * 0.5))} phút` : "Chưa có từ nào. Từ bạn ký đúng sẽ quay lại sau 8 giờ, 1 ngày, 3 ngày…"}
          </span>
          <Btn href="/quiz?mode=review" level="tertiary" size="md" block={false} disabled={!due.length} style={{ width: "fit-content", minHeight: 48 }}>
            Ôn ngay
          </Btn>
        </div>
        <div className="sticker-tilt" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/mascot_cheer.png" alt="" style={{ width: 96, height: 98, objectFit: "contain" }} />
        </div>
      </section>

      <h2 className="h4">Chế độ luyện</h2>
      <div style={{ display: "flex", gap: 12, height: 200 }}>
        <Link href="/the-ghi-nho" className="tile t-yel" style={{ flex: 1, minWidth: 0, justifyContent: "flex-start" }}>
          <span className="icon-circle" style={{ width: 48, height: 48, background: "var(--surface)", boxShadow: "var(--shadow-tile)" }}>
            <Copy size={24} aria-hidden />
          </span>
          <span className="col" style={{ gap: 2 }}>
            <span className="h4">Thẻ ghi nhớ</span>
            <span className="t-sub">{labels.length} thẻ · lật thẻ và tự chấm</span>
          </span>
          <span className="grow" />
          <span className="row" style={{ gap: 6, fontSize: 14, fontWeight: 600, color: "var(--yel-txt)" }}>
            Bắt đầu <ArrowRight size={18} aria-hidden />
          </span>
        </Link>
        <div className="col" style={{ flex: 1, minWidth: 0, gap: 12 }}>
          <Link href="/quiz" className="tile t-grn" style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/hand_yellow.png" alt="" style={{ width: 40, height: 40, objectFit: "contain", flex: "none" }} />
            <span className="col" style={{ gap: 2, minWidth: 0 }}>
              <span className="h4">Đố vui</span>
              <span className="t-sub">8 từ · {learnedCount} đã thuộc</span>
            </span>
          </Link>
          <Link href="/tu-dien" className="tile t-pnk" style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <span className="icon-circle" style={{ width: 40, height: 40, background: "var(--surface)", boxShadow: "var(--shadow-tile)" }}>
              <Camera size={22} aria-hidden />
            </span>
            <span className="col" style={{ gap: 2, minWidth: 0 }}>
              <span className="h4">Tự chọn</span>
              <span className="t-sub">Từ bất kỳ</span>
            </span>
          </Link>
        </div>
      </div>

      <Link href="/cau" className="tile t-pur" style={{ flexDirection: "row", gap: 8, padding: "18px 0 0 18px", alignItems: "flex-start" }}>
        <span className="col grow" style={{ gap: 4, paddingBottom: 18, minWidth: 0 }}>
          <span className="badge badge--s" style={{ background: "var(--pur)", color: "#fff" }}>
            Mới
          </span>
          <span className="h4">Câu giao tiếp</span>
          <span className="t-sub">59 câu ký liền mạch: chào hỏi, đi khám, mua sắm</span>
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/presenter_peace.png" alt="" style={{ width: 112, height: 140, objectFit: "contain", flex: "none" }} />
      </Link>
      <Link href="/dich" className="tile t-blu" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <span className="icon-circle" style={{ width: 48, height: 48, background: "var(--surface)", boxShadow: "var(--shadow-tile)" }}>
          <Languages size={24} aria-hidden />
        </span>
        <span className="col grow" style={{ gap: 2, minWidth: 0 }}>
          <span className="h4">Dịch ký hiệu</span>
          <span className="t-sub">Ký liên tục, app hiện chữ và đọc to · thử nghiệm</span>
        </span>
        <ChevronRight size={20} aria-hidden />
      </Link>

      <h2 className="h4">Từ yếu cần luyện</h2>
      {weak.length === 0 ? (
        <p className="bm" style={{ margin: 0 }}>
          Chưa có. Từ nào bạn ký đúng dưới 70% sẽ hiện ở đây để luyện lại.
        </p>
      ) : (
        <div className="card card--list" style={{ borderRadius: 24, padding: "4px 16px" }}>
          {weak.map(([w, s]) => {
            const pct = Math.round((s.correct / s.attempts) * 100);
            return (
              <Link key={w} href={practiceUrl(w)} className="list-row" style={{ gap: 14 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="thumb thumb--52" src={thumbUrl(w)} alt="" style={{ borderRadius: 14 }} loading="lazy" />
                <span className="col grow" style={{ gap: 4, minWidth: 0 }}>
                  <span className="bb" style={{ fontSize: 14, fontWeight: 600 }}>
                    {w}
                  </span>
                  <span className="t-sub">
                    Đúng {s.correct}/{s.attempts} lần
                  </span>
                  <span className="bar" style={{ height: 6 }}>
                    <i style={{ width: `${Math.max(pct, 4)}%`, background: pct < 40 ? "var(--red)" : "var(--yel)" }} />
                  </span>
                </span>
                <span className="icon-circle" style={{ width: 44, height: 44, background: "var(--brand-soft)", color: "var(--acc)" }} aria-hidden>
                  <RotateCcw size={22} />
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <section className="tile t-org" style={{ flexDirection: "row", alignItems: "center", gap: 14 }} aria-label="Thử thách">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/target.png" alt="" style={{ width: 60, height: 60, objectFit: "contain", flex: "none" }} />
        <span className="col grow" style={{ gap: 6, minWidth: 0 }}>
          <span className="t-sub" style={{ color: "var(--org-txt)", fontWeight: 600 }}>
            Thử thách · huy hiệu Combo
          </span>
          <span className="bb" style={{ fontSize: 14 }}>
            Ký đúng 10 lần liên tiếp
          </span>
          <span className="row" style={{ gap: 10 }}>
            <span className="bar grow" style={{ height: 10 }}>
              <i style={{ width: `${Math.max((combo / 10) * 100, combo ? 4 : 0)}%`, background: "var(--org)" }} />
            </span>
            <span className="bb num" style={{ fontSize: 14 }}>
              {combo}/10
            </span>
          </span>
        </span>
      </section>
      <BottomNav />
    </main>
  );
}
