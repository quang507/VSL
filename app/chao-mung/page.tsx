"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Camera, Route, Vibrate, MapPin, Check, ShieldCheck } from "lucide-react";
import { Bar, Btn, IconBtn, IconCircle } from "@/components/ui";
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

  if (step === 0)
    return (
      <main className="app app--center" style={{ gap: 18 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/logo.png" alt="VSLV — Learn. Sign. Connect." style={{ width: 150, marginTop: 8 }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/presenter_wave.png" alt="" style={{ width: 260, height: 260, objectFit: "contain" }} />
        <h1 className="h1">Học ngôn ngữ ký hiệu Việt Nam</h1>
        <div className="card" style={{ width: "100%", textAlign: "left" }}>
          {[
            [Camera, "Camera AI chấm điểm ngay trên máy", "var(--brand-soft)", "var(--acc)"],
            [Route, "Lộ trình theo chủ đề, 100 ký hiệu", "var(--grn-soft)", "var(--grn-txt)"],
            [Vibrate, "Báo đúng/sai bằng rung và màu, không cần âm thanh", "var(--yel-soft)", "var(--yel-txt)"],
          ].map(([I, t, bg, fg]) => (
            <div key={t as string} className="row">
              <IconCircle icon={I as typeof Camera} size={40} bg={bg as string} fg={fg as string} />
              <span className="bm" style={{ color: "var(--txt)" }}>
                {t as string}
              </span>
            </div>
          ))}
        </div>
        <div className="grow" />
        <Btn onClick={() => setStep(1)}>Bắt đầu</Btn>
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
          <div className="row" style={{ justifyContent: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/ai_hand.png" alt="" style={{ width: 200, height: 200, objectFit: "contain" }} />
          </div>
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
