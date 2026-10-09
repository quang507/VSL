"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, MessageCircle, Info } from "lucide-react";
import { Bar, IconCircle, TopBar } from "@/components/ui";
import { usePhrases, phraseUrl } from "@/lib/phrases";
import { useProgress } from "@/lib/useProgress";
import { isLearned, countLearned } from "@/lib/progress";

export default function Phrases() {
  const { labels, loading } = usePhrases();
  const [progress] = useProgress();
  const done = countLearned(progress, labels);

  return (
    <main className="app">
      <TopBar title="Câu giao tiếp" back="/" />
      <section className="tile t-pur" style={{ padding: 20, gap: 12 }}>
        <div className="row">
          <IconCircle icon={MessageCircle} size={56} bg="var(--surface)" fg="var(--pur-txt)" />
          <div className="col col--tight grow">
            <span className="sm tone-txt">{labels.length} câu dùng hằng ngày</span>
            <span className="h3">Câu giao tiếp</span>
          </div>
        </div>
        <div className="row">
          <Bar pct={labels.length ? (done / labels.length) * 100 : 0} color="var(--pur)" track="rgba(255,255,255,.6)" />
          <span className="bb" style={{ flex: "none" }}>
            {done}/{labels.length}
          </span>
        </div>
      </section>

      <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
        <Info size={18} color="var(--txt3)" aria-hidden style={{ flex: "none", marginTop: 2 }} />
        <span className="sm">
          Mẫu là hoạt hình khung xương bàn tay, dựng lại từ dữ liệu của dự án Look &amp; Tell (Apache-2.0). Mỗi câu được ký liền một lần.
        </span>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 300, borderRadius: 24 }} />
      ) : labels.length === 0 ? (
        <div className="card">Chưa có model câu giao tiếp.</div>
      ) : (
        <div className="card card--list">
          {labels.map((p, i) => {
            const learned = isLearned(progress, p);
            return (
              <Link key={p} href={phraseUrl(i)} className="list-row" style={{ minHeight: 64 }}>
                <span className="icon-circle" style={{ width: 36, height: 36, background: learned ? "var(--grn)" : "var(--neu)", color: learned ? "#fff" : "var(--txt2)", fontWeight: 700, fontSize: 14 }}>
                  {learned ? <CheckCircle2 size={20} aria-hidden /> : i + 1}
                </span>
                <span className="bb grow">{p}</span>
                <ChevronRight size={20} color="var(--txt3)" aria-hidden />
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
