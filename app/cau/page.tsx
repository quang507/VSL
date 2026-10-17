"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, MessageCircle, Info, Heart, Eye, Sun, Sparkles } from "lucide-react";
import { Bar, IconCircle, TopBar, Segmented } from "@/components/ui";
import { usePhrases, phraseUrl, UNCLEAR_PHRASES, getPhraseMeta } from "@/lib/phrases";
import { useProgress } from "@/lib/useProgress";
import { isLearned, countLearned } from "@/lib/progress";

const CULTURE_TIPS = [
  {
    icon: Sparkles,
    bg: "var(--brand-soft)",
    fg: "var(--acc)",
    title: "1. Cách gây chú ý lịch sự",
    desc: "Vẫy tay nhẹ nhàng trong tầm nhìn của người đối diện. Hoặc chạm nhẹ vào bả vai, gõ nhẹ mặt bàn tạo độ rung nhẹ. Tuyệt đối không la hét từ phía sau, ném đồ hoặc xua tay sát mặt.",
  },
  {
    icon: Eye,
    bg: "var(--grn-soft)",
    fg: "var(--grn-txt)",
    title: "2. Giao tiếp mắt là sự tôn trọng",
    desc: "Khi người Điếc đang ký, hãy duy trì ánh mắt hướng vào khuôn mặt và bàn tay họ. Nhìn đi chỗ khác khi họ đang ký tương đương với hành động 'bịt tai quay lưng bỏ đi' trong văn hóa người nghe.",
  },
  {
    icon: Sun,
    bg: "var(--yel-soft)",
    fg: "var(--yel-txt)",
    title: "3. Ánh sáng và Khoảng cách đứng",
    desc: "Đứng cách người đối diện 1.2m – 1.8m để quan sát trọn vẹn cả cử chỉ tay lẫn khẩu hình. Luôn đứng thuận sáng (ánh sáng chiếu vào mặt bạn), không đứng ngược sáng khiến đối phương bị chói mắt.",
  },
  {
    icon: Heart,
    bg: "var(--pnk-soft)",
    fg: "var(--pnk-txt)",
    title: "4. Kiên nhẫn và Đa kênh giao tiếp",
    desc: "Nếu chưa hiểu, hãy ra hiệu chậm lại hoặc dùng bảng chữ cái ngón tay (Fingerspelling). Đừng ngại kết hợp giấy bút, tin nhắn điện thoại hoặc hình ảnh. Sự kiên nhẫn và nụ cười ấm áp là cầu nối gia đình quý giá nhất.",
  },
];

export default function Phrases() {
  const { labels: all, loading } = usePhrases();
  const [pageTab, setPageTab] = useState<"phrases" | "culture">("phrases");
  const [cat, setCat] = useState<string>("all");
  // giữ chỉ số gốc (khớp đầu ra model) nhưng bỏ câu chưa rõ nghĩa
  const items = all.map((p, i) => ({ p, i })).filter(({ p }) => !UNCLEAR_PHRASES.has(p));
  const labels = items.map(({ p }) => p);
  const [progress] = useProgress();
  const done = countLearned(progress, labels);

  const filtered = useMemo(() => {
    if (cat === "all") return items;
    return items.filter(({ p }) => getPhraseMeta(p).category === cat);
  }, [items, cat]);

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

      <Segmented<"phrases" | "culture">
        label="Chế độ xem"
        value={pageTab}
        onChange={setPageTab}
        items={[
          { v: "phrases", label: "59 Câu giao tiếp" },
          { v: "culture", label: "Văn hóa & Ứng xử" },
        ]}
      />

      {pageTab === "culture" ? (
        <section className="col" style={{ gap: 14 }} aria-label="Cẩm nang văn hóa người Điếc">
          <div className="card" style={{ gap: 6, background: "var(--brand-soft)", borderColor: "transparent", padding: "16px 18px" }}>
            <span className="h4" style={{ color: "var(--acc)" }}>4 Nguyên tắc vàng khi giao tiếp</span>
            <span className="bm" style={{ color: "var(--txt)", fontSize: 15, lineHeight: 1.5 }}>
              Học ngôn ngữ ký hiệu không chỉ là học hình tay, mà là học cách thấu hiểu và kết nối văn minh với thế giới của người khiếm thính trong gia đình.
            </span>
          </div>

          <div className="col" style={{ gap: 12 }}>
            {CULTURE_TIPS.map((tip) => {
              const Icon = tip.icon;
              return (
                <div key={tip.title} className="card" style={{ gap: 10, padding: 18, borderRadius: 20 }}>
                  <div className="row" style={{ gap: 12, alignItems: "center" }}>
                    <IconCircle icon={Icon} size={42} bg={tip.bg} fg={tip.fg} square />
                    <h2 className="h4" style={{ margin: 0, fontSize: 17, color: "var(--txt)" }}>{tip.title}</h2>
                  </div>
                  <p className="bm" style={{ margin: 0, color: "var(--txt2)", fontSize: 15, lineHeight: 1.5 }}>
                    {tip.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <>
          <div className="chips" role="group" aria-label="Nhóm câu">
            <button type="button" className="chip" aria-pressed={cat === "all"} onClick={() => setCat("all")}>
              Tất cả ({items.length})
            </button>
            <button type="button" className="chip" aria-pressed={cat === "family"} onClick={() => setCat("family")}>
              Gia đình & Cảm xúc
            </button>
            <button type="button" className="chip" aria-pressed={cat === "health"} onClick={() => setCat("health")}>
              Sức khỏe & Nhu cầu
            </button>
            <button type="button" className="chip" aria-pressed={cat === "questions"} onClick={() => setCat("questions")}>
              Hỏi đáp
            </button>
            <button type="button" className="chip" aria-pressed={cat === "daily"} onClick={() => setCat("daily")}>
              Thường nhật
            </button>
          </div>

          {loading ? (
            <div className="skeleton" style={{ height: 300, borderRadius: 24 }} />
          ) : labels.length === 0 ? (
            <div className="card">Chưa có model câu giao tiếp.</div>
          ) : (
            <div className="card card--list">
              {filtered.map(({ p, i }, n) => {
                const learned = isLearned(progress, p);
                const meta = getPhraseMeta(p);
                return (
                  <Link key={p} href={phraseUrl(i)} className="list-row" style={{ minHeight: 68, gap: 12 }}>
                    <span className="icon-circle" style={{ width: 36, height: 36, background: learned ? "var(--grn)" : "var(--neu)", color: learned ? "#fff" : "var(--txt2)", fontWeight: 700, fontSize: 14 }}>
                      {learned ? <CheckCircle2 size={20} aria-hidden /> : n + 1}
                    </span>
                    <span className="col col--tight grow" style={{ minWidth: 0 }}>
                      <span className="bb">{p}</span>
                      <span className="sm" style={{ color: meta.expression.color, fontWeight: 600 }}>
                        {meta.expression.badge}
                      </span>
                    </span>
                    <ChevronRight size={20} color="var(--txt3)" aria-hidden />
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
