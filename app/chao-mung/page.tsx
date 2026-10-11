"use client";

import { asset } from "@/lib/base";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, MapPin, Check, ShieldCheck } from "lucide-react";
import { Bar, Btn, IconBtn, IconCircle } from "@/components/ui";
import LoopVideo from "@/components/LoopVideo";
import { REGIONS, saveProfile, type Region } from "@/lib/profile";
import { setDailyGoal } from "@/lib/progress";

const GOALS = [
  { v: 3, t: "Nhẹ nhàng", s: "3 lần ký đúng mỗi ngày" },
  { v: 5, t: "Đều đặn", s: "5 lần ký đúng mỗi ngày" },
  { v: 10, t: "Nghiêm túc", s: "10 lần ký đúng mỗi ngày" },
  { v: 15, t: "Tăng tốc", s: "15 lần ký đúng mỗi ngày" },
];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [region, setRegion] = useState<Region>("hcm");
  const [goal, setGoal] = useState(5);
  const total = 4;

  const finish = () => {
    saveProfile({ name: name.trim(), region, onboarded: true });
    setDailyGoal(goal);
    router.replace("/");
  };

  // Figma · Onboarding · "Screen / Welcome" (302:9472). App không có tài khoản → thay khối
  // "Đăng nhập nhanh" (Google/Apple/Facebook) bằng một nút Bắt đầu; dữ liệu lưu trên máy.
  if (step === 0)
    return (
      <main className="app" style={{ padding: 0, gap: 0, minHeight: "100dvh", overflow: "hidden" }}>
        {/* Group / Background Decorations (302:9515): x −40, y −43.5, 541×300 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/img/figma/w-blobs.svg")} alt="" width={541} height={300} style={{ position: "absolute", left: -40, top: -43.5, width: 541, height: 300, zIndex: -1, pointerEvents: "none" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingTop: "calc(env(safe-area-inset-top) + 34px)" }}>
          {/* Image / Brand Logo (302:9527): 120×82 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset("/img/logo.webp")} alt="VSLV — Learn. Sign. Connect." style={{ width: 120, height: 82, objectFit: "contain", margin: "0 auto 4px", flex: "none" }} />
          {/* Group / Welcome Artwork (302:9473): khung 402×341, toạ độ theo % */}
          <div className="welcome-art" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset("/img/figma/w-string.webp")} alt="" style={{ left: "0%", top: "32.55%", width: "100%", height: "67.45%" }} />
            <span style={{ left: "51%", top: "14.66%", width: "44.36%", height: "53.39%" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/img/figma/w-mascot.webp")} alt="" style={{ width: "84.12%", height: "85.03%", transform: "rotate(11.72deg)" }} />
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset("/img/figma/w-presenter.webp")} alt="" fetchPriority="high" style={{ left: "10.45%", top: "11.73%", width: "69.65%", height: "78.01%" }} />
            <span style={{ left: "50%", top: "0%", width: "27.78%", height: "32.5%" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/img/figma/w-greeting.webp")} alt="" style={{ width: "80.6%", height: "80.08%", transform: "rotate(16.65deg)" }} />
            </span>
          </div>
        </div>
        {/* Group / Authentication Options (302:9479) — app không có tài khoản: giữ khung, thay nội dung */}
        <section className="welcome-sheet">
          <div className="col center" style={{ gap: 0 }}>
            <h1 className="h3" style={{ color: "var(--txt)", lineHeight: "32px" }}>
              Học ngôn ngữ ký hiệu
            </h1>
            <p className="bm" style={{ margin: 0, fontSize: 16, lineHeight: "24px" }}>
              Cùng khám phá ngôn ngữ ký hiệu Việt Nam nhé.
            </p>
          </div>
          <ul className="col" style={{ listStyle: "none", margin: 0, padding: 0, gap: 10 }}>
            {[
              ["1", "Xem người thật ký mẫu, xem chậm được"],
              ["2", "Ký trước camera, app chấm ngay trên máy"],
              ["3", "Biết đúng sai bằng rung và màu, không cần âm thanh"],
            ].map(([n, t]) => (
              <li key={n} className="row" style={{ gap: 12 }}>
                <span className="icon-circle" style={{ width: 28, height: 28, background: "var(--acc-subtle)", color: "var(--acc)", fontWeight: 700, fontSize: 14 }}>
                  {n}
                </span>
                <span className="bm" style={{ color: "var(--txt)", fontSize: 15 }}>
                  {t}
                </span>
              </li>
            ))}
          </ul>
          <Btn onClick={() => setStep(1)} style={{ background: "var(--yel)", color: "var(--txt)", boxShadow: "0 4px 0 #c99a12" }}>
            Bắt đầu
          </Btn>
          <p className="sm center" style={{ margin: 0 }}>
            Không cần tài khoản · tiến độ lưu ngay trên máy
          </p>
        </section>
      </main>
    );

  return (
    <main className="app" style={{ gap: 22 }}>
      <div className="topbar" style={{ gap: 14 }}>
        <IconBtn icon={ChevronLeft} label="Quay lại" onClick={() => setStep(step - 1)} />
        <Bar pct={(step / total) * 100} h={12} />
        <span className="bb muted">
          {step}/{total}
        </span>
      </div>

      {step === 1 && (
        <>
          <h1 className="h2">Bạn tên là gì?</h1>
          <p className="bm" style={{ margin: 0 }}>
            Tên hiển thị trong app. Có thể đổi sau trong Cài đặt.
          </p>
          <label className="field">
            <span className="bb">Tên hiển thị</span>
            <span className="input">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Minh" autoComplete="given-name" maxLength={30} />
            </span>
          </label>
          <div className="grow" />
          <Btn onClick={() => setStep(2)}>{name.trim() ? "Tiếp tục" : "Bỏ qua"}</Btn>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="h2">Bạn dùng ký hiệu vùng nào?</h1>
          <p className="bm" style={{ margin: 0 }}>
            Ký hiệu có thể khác nhau giữa các vùng. Bạn đổi lại được bất cứ lúc nào.
          </p>
          <div className="col">
            {REGIONS.map((r) => {
              const sel = r.id === region;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRegion(r.id)}
                  aria-pressed={sel}
                  className="card card--row"
                  style={{ border: sel ? "2.5px solid var(--brand)" : "2.5px solid transparent", background: sel ? "var(--brand-soft)" : "var(--surface)", textAlign: "left" }}
                >
                  <IconCircle icon={MapPin} bg={sel ? "var(--surface)" : "var(--neu)"} fg="var(--acc)" square size={48} />
                  <span className="col col--tight grow">
                    <span className="bb">{r.name}</span>
                    <span className="sm">{r.sub}</span>
                  </span>
                  <span className="icon-circle" style={{ width: 26, height: 26, background: sel ? "var(--brand)" : "var(--surface)", border: sel ? "none" : "2px solid var(--line)", color: "#fff" }}>
                    {sel && <Check size={16} aria-hidden />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="grow" />
          <Btn onClick={() => setStep(3)}>Tiếp tục</Btn>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="h2">Mỗi ngày bạn muốn luyện bao nhiêu?</h1>
          <div className="col">
            {GOALS.map((g) => {
              const sel = g.v === goal;
              return (
                <button
                  key={g.v}
                  type="button"
                  onClick={() => setGoal(g.v)}
                  aria-pressed={sel}
                  className="card card--row"
                  style={{ border: sel ? "2.5px solid var(--grn)" : "2.5px solid transparent", background: sel ? "var(--grn-soft)" : "var(--surface)", textAlign: "left" }}
                >
                  <span className="h3" style={{ width: 48, textAlign: "center" }}>
                    {g.v}
                  </span>
                  <span className="col col--tight grow">
                    <span className="bb">{g.t}</span>
                    <span className="sm">{g.s}</span>
                  </span>
                  {g.v === 5 && (
                    <span className="pill" style={{ background: "var(--grn)", color: "#fff" }}>
                      Gợi ý
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="grow" />
          <Btn onClick={() => setStep(4)}>Tiếp tục</Btn>
        </>
      )}

      {step === 4 && (
        <>
          <LoopVideo word="Cảm ơn" style={{ aspectRatio: "4 / 3", maxWidth: 520, width: "100%", margin: "0 auto" }} />
          <h1 className="h2">Camera giúp chấm điểm ký hiệu</h1>
          <div className="tile t-grn" style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <IconCircle icon={ShieldCheck} bg="var(--surface)" fg="var(--grn-txt)" />
            <span className="bm" style={{ color: "var(--txt)" }}>
              Video không rời khỏi máy. App chỉ đọc vị trí bàn tay để chấm điểm.
            </span>
          </div>
          <p className="bm" style={{ margin: 0 }}>
            Khi luyện, trình duyệt sẽ hỏi quyền dùng camera. Bạn vẫn xem được video mẫu nếu chưa cho phép.
          </p>
          <div className="grow" />
          <Btn onClick={finish}>Vào học</Btn>
        </>
      )}
    </main>
  );
}
