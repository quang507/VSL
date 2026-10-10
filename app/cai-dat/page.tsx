"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Vibrate, Zap, Volume2, Gauge, ShieldCheck, Trash2, Info, Check } from "lucide-react";
import { Btn, Dialog, IconCircle, Segmented, Toggle, TopBar } from "@/components/ui";
import { REGIONS, useProfile, resetProfile } from "@/lib/profile";
import { useProgress } from "@/lib/useProgress";
import { setDailyGoal, setSoundOn, resetProgress, loadProgress } from "@/lib/progress";
import { canVibrate, signal } from "@/lib/feedback";

function Row({ icon, bg, fg, title, sub, right }: { icon: typeof MapPin; bg: string; fg: string; title: string; sub?: string; right: React.ReactNode }) {
  return (
    <div className="list-row">
      <IconCircle icon={icon} size={36} bg={bg} fg={fg} square />
      <span className="col col--tight grow">
        <span className="bb">{title}</span>
        {sub && <span className="sm">{sub}</span>}
      </span>
      {right}
    </div>
  );
}

export default function Settings() {
  const router = useRouter();
  const { profile, update } = useProfile();
  // Chỉ biết sau khi chạy trên máy (tránh lệch giữa bản dựng sẵn và trình duyệt)
  const [vib, setVib] = useState(true);
  useEffect(() => setVib(canVibrate()), []);
  const [progress, setProgress] = useProgress();
  const [confirm, setConfirm] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const region = REGIONS.find((r) => r.id === profile.region);

  return (
    <main className="app" style={{ gap: 18 }}>
      <TopBar title="Cài đặt" back="/ho-so" />

      <label className="field">
        <span className="bb muted">Tên hiển thị</span>
        <span className="input">
          <input value={profile.name} onChange={(e) => update({ name: e.target.value })} placeholder="Tên của bạn" maxLength={30} />
        </span>
      </label>

      <span className="bb muted">Học tập</span>
      <div className="card card--list">
        <button type="button" className="list-row" onClick={() => setRegionOpen(true)} style={{ border: "none", background: "none", textAlign: "left", width: "100%", padding: "14px 0" }}>
          <IconCircle icon={MapPin} size={36} bg="var(--brand-soft)" fg="var(--acc)" square />
          <span className="col col--tight grow">
            <span className="bb">Vùng ký hiệu</span>
            <span className="sm">{region?.name}</span>
          </span>
        </button>
        <div className="col" style={{ padding: "14px 0", borderTop: "1px solid var(--line)" }}>
          <span className="bb">Mục tiêu mỗi ngày (lần ký đúng)</span>
          <Segmented
            label="Mục tiêu mỗi ngày"
            value={progress.dailyGoal}
            onChange={(v) => setProgress(setDailyGoal(v))}
            items={[3, 5, 10, 15].map((v) => ({ v, label: String(v) }))}
          />
        </div>
        <Row icon={Gauge} bg="var(--yel-soft)" fg="var(--yel-txt)" title="Video mẫu phát chậm" sub="Mặc định 0.5x" right={<Toggle label="Video mẫu phát chậm" on={profile.slowVideo} onChange={(v) => update({ slowVideo: v })} />} />
      </div>

      <span className="bb muted">Báo đúng / sai</span>
      <div className="card card--list">
        <Row
          icon={Vibrate}
          bg="var(--pur-soft)"
          fg="var(--pur-txt)"
          title="Rung"
          sub={vib ? "Đúng: rung 1 nhịp · Sai: rung 2 nhịp" : "Trình duyệt này không rung được. Bản cài từ cửa hàng ứng dụng có rung."}
          right={
            vib ? (
              <Toggle
                label="Rung"
                on={profile.vibrate}
                onChange={(v) => {
                  update({ vibrate: v });
                  if (v) signal(true, { sound: false, vibrate: true }); // rung thử để biết đã bật
                }}
              />
            ) : (
              <span className="sm" style={{ flex: "none" }}>Không hỗ trợ</span>
            )
          }
        />
        <Row icon={Zap} bg="var(--grn-soft)" fg="var(--grn-txt)" title="Nháy viền màn hình" sub="Xanh khi đúng, đỏ khi sai" right={<Toggle label="Nháy viền màn hình" on={profile.flash} onChange={(v) => update({ flash: v })} />} />
        <Row icon={Volume2} bg="var(--neu)" fg="var(--txt)" title="Âm thanh" sub="Cho người nghe trong gia đình" right={<Toggle label="Âm thanh" on={progress.soundOn} onChange={(v) => setProgress(setSoundOn(v))} />} />
      </div>

      <div className="tile t-grn" style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <IconCircle icon={ShieldCheck} bg="var(--surface)" fg="var(--grn-txt)" />
        <span className="bm" style={{ color: "var(--txt)" }}>
          Camera xử lý ngay trên máy. Video không được gửi đi đâu. Tiến độ chỉ lưu trên thiết bị này.
        </span>
      </div>

      <div className="card card--list">
        <button type="button" className="list-row" onClick={() => setConfirm(true)} style={{ border: "none", background: "none", textAlign: "left", width: "100%", padding: "14px 0", color: "var(--neg)" }}>
          <IconCircle icon={Trash2} size={36} bg="var(--red-soft)" fg="var(--neg)" square />
          <span className="bb">Xoá toàn bộ tiến độ</span>
        </button>
      </div>

      <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
        <Info size={18} color="var(--txt3)" aria-hidden style={{ flex: "none", marginTop: 2 }} />
        <span className="sm" style={{ fontSize: 12 }}>
          VSLV 1.0 · Nhận diện bằng MediaPipe + TensorFlow.js. Video mẫu từ đơn: ViSignLanguage-Video (PTIT AI Challenge), CC-BY-4.0. Dữ liệu câu giao tiếp: dự án Look & Tell (khooinguyeen/Vietnamese-Sign-Language-Translation), Apache-2.0.
        </span>
      </div>

      <Dialog open={regionOpen} onClose={() => setRegionOpen(false)}>
        <span className="h3">Chọn vùng ký hiệu</span>
        <span className="bm">Tiến độ và từ đã thuộc vẫn giữ nguyên khi đổi vùng.</span>
        <div className="col" style={{ width: "100%" }}>
          {REGIONS.map((r) => {
            const sel = r.id === profile.region;
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={sel}
                onClick={() => {
                  update({ region: r.id });
                  setRegionOpen(false);
                }}
                className="row"
                style={{ minHeight: 56, padding: "8px 14px", borderRadius: 16, border: sel ? "2px solid var(--brand)" : "1.5px solid var(--line)", background: sel ? "var(--brand-soft)" : "var(--surface)", textAlign: "left" }}
              >
                <span className="bb grow">{r.name}</span>
                {sel && <Check size={20} color="var(--acc)" aria-hidden />}
              </button>
            );
          })}
        </div>
      </Dialog>

      <Dialog open={confirm} onClose={() => setConfirm(false)}>
        <IconCircle icon={Trash2} size={72} bg="var(--red-soft)" fg="var(--neg)" />
        <span className="h3">Xoá toàn bộ tiến độ?</span>
        <span className="bm">Từ đã thuộc, chuỗi ngày, XP và huy hiệu sẽ mất. Không hoàn tác được.</span>
        <div className="row" style={{ width: "100%" }}>
          <Btn level="tertiary" size="md" onClick={() => setConfirm(false)}>
            Huỷ
          </Btn>
          <Btn
            level="danger"
            size="md"
            onClick={() => {
              resetProgress();
              resetProfile();
              setProgress(loadProgress());
              setConfirm(false);
              router.replace("/chao-mung");
            }}
          >
            Xoá
          </Btn>
        </div>
      </Dialog>
    </main>
  );
}
