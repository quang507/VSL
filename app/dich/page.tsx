"use client";

import { useEffect, useState } from "react";
import { Volume2, Maximize2, Trash2, Pause, Play, X, Info, Hand, Loader2, FlaskConical } from "lucide-react";
import CameraStage from "@/components/CameraStage";
import { Btn, Dialog, IconBtn, Pill, Segmented, TopBar } from "@/components/ui";
import { useContinuousSign } from "@/lib/useContinuousSign";
import { MODEL_URL, LABELS_URL } from "@/lib/constants";
import type { Prediction } from "@/lib/classifier";

const PHRASE_MODEL = "/models/phrases/model.json";
const PHRASE_LABELS = "/models/phrases/labels.json";

interface Item {
  top: Prediction[];
  pick: number;
}

export default function Translate() {
  const [mode, setMode] = useState<"word" | "phrase">("word");
  const [hasPhrases, setHasPhrases] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [big, setBig] = useState(false);
  const [ttsMsg, setTtsMsg] = useState("");

  useEffect(() => {
    fetch(PHRASE_MODEL, { method: "HEAD" })
      .then((r) => setHasPhrases(r.ok))
      .catch(() => setHasPhrases(false));
  }, []);

  const { videoRef, canvasRef, status, handsVisible, hint, modelReady, cameraError, paused, setPaused } = useContinuousSign(
    mode === "word" ? MODEL_URL : PHRASE_MODEL,
    mode === "word" ? LABELS_URL : PHRASE_LABELS,
    (top) => setItems((xs) => [...xs, { top, pick: 0 }])
  );

  const text = items.map((it) => it.top[it.pick]?.label ?? "").join(" ");

  const speak = () => {
    if (!("speechSynthesis" in window) || !text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "vi-VN";
    const vi = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("vi"));
    if (vi) u.voice = vi;
    else setTtsMsg("Máy chưa có giọng đọc tiếng Việt, đang dùng giọng mặc định.");
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  };

  const statusPill =
    status === "loading" || !modelReady ? (
      <Pill bg="var(--neu)" fg="var(--txt2)" icon={Loader2}>
        Đang tải mô hình…
      </Pill>
    ) : paused ? (
      <Pill bg="var(--neu)" fg="var(--txt2)" icon={Pause}>
        Đã tạm dừng
      </Pill>
    ) : status === "watching" ? (
      <Pill bg="var(--red)" fg="#fff">
        ● Đang xem bạn ký
      </Pill>
    ) : status === "thinking" ? (
      <Pill bg="var(--brand)" fg="#fff" icon={Loader2}>
        Đang nhận diện…
      </Pill>
    ) : (
      <Pill bg="var(--grn-soft)" fg="var(--grn-txt)" icon={Hand}>
        Sẵn sàng · ký từng từ rồi hạ tay
      </Pill>
    );

  return (
    <main className="app" style={{ gap: 16 }}>
      <TopBar title="Dịch ký hiệu" back="/luyen-tap" right={<IconBtn icon={paused ? Play : Pause} label={paused ? "Tiếp tục" : "Tạm dừng"} onClick={() => setPaused(!paused)} />} />

      <div className="row" style={{ gap: 8 }}>
        <Pill bg="var(--pur-soft)" fg="var(--pur-txt)" icon={FlaskConical}>
          Thử nghiệm
        </Pill>
        <span className="sm">AI có thể nhận sai, chạm vào từ để sửa.</span>
      </div>

      <Segmented
        label="Loại nhận diện"
        value={mode}
        onChange={(v) => {
          if (v === "phrase" && !hasPhrases) return;
          setMode(v);
          setItems([]);
        }}
        items={[
          { v: "word", label: "Từ đơn · 100 từ" },
          { v: "phrase", label: hasPhrases ? "Câu giao tiếp" : "Câu (sắp có)" },
        ]}
      />

      <CameraStage videoRef={videoRef} canvasRef={canvasRef} phase={status === "loading" ? "loading" : "ready"} count={0} handsVisible={handsVisible} hint={hint} error={!!cameraError} />
      <div className="row" style={{ justifyContent: "center" }}>
        {statusPill}
      </div>

      <section className="card" style={{ minHeight: 120 }}>
        <div className="row row--between">
          <span className="bb">Bản dịch</span>
          <span className="sm">{items.length} từ</span>
        </div>
        {items.length === 0 ? (
          <span className="bm">Ký từng từ trước camera. Sau mỗi từ, dừng tay một chút hoặc hạ tay xuống.</span>
        ) : (
          <div className="row wrap" style={{ gap: 8 }}>
            {items.map((it, i) => {
              const p = it.top[it.pick];
              const low = p.confidence < 0.5;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setEditing(i)}
                  className="pill"
                  style={{
                    minHeight: 44,
                    fontSize: 17,
                    padding: "8px 14px",
                    border: low ? "2px dashed var(--org)" : "2px solid var(--brand-bd)",
                    background: low ? "var(--org-soft)" : "var(--brand-soft)",
                    color: "var(--txt)",
                  }}
                  aria-label={`${p.label}, độ tin cậy ${Math.round(p.confidence * 100)}%. Chạm để sửa`}
                >
                  {p.label}
                  {low && "?"}
                  <span className="sm" style={{ fontSize: 12 }}>
                    {Math.round(p.confidence * 100)}%
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="row">
        <Btn icon={Volume2} size="md" onClick={speak} disabled={!items.length}>
          Đọc to
        </Btn>
        <Btn icon={Maximize2} size="md" level="tertiary" onClick={() => setBig(true)} disabled={!items.length}>
          Phóng to
        </Btn>
        <IconBtn icon={Trash2} label="Xoá bản dịch" onClick={() => setItems([])} />
      </div>
      {ttsMsg && <span className="sm">{ttsMsg}</span>}

      {cameraError && (
        <div className="tile t-red" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Info size={22} color="var(--neg)" aria-hidden />
          <span className="bm" style={{ color: "var(--txt)" }}>
            Không mở được camera. Hãy cho phép quyền camera rồi tải lại trang.
          </span>
        </div>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)}>
        <span className="h3">Có phải bạn muốn nói…</span>
        <div className="col" style={{ width: "100%" }}>
          {editing !== null &&
            items[editing]?.top.map((c, k) => (
              <button
                key={c.label}
                type="button"
                onClick={() => {
                  setItems((xs) => xs.map((x, i) => (i === editing ? { ...x, pick: k } : x)));
                  setEditing(null);
                }}
                className="row"
                style={{ minHeight: 56, padding: "8px 14px", borderRadius: 16, border: k === items[editing].pick ? "2px solid var(--brand)" : "1.5px solid var(--line)", background: k === items[editing].pick ? "var(--brand-soft)" : "var(--surface)" }}
              >
                <span className="bb grow" style={{ textAlign: "left" }}>
                  {c.label}
                </span>
                <span className="sm">{Math.round(c.confidence * 100)}%</span>
              </button>
            ))}
        </div>
        <Btn
          level="danger"
          size="md"
          icon={Trash2}
          onClick={() => {
            setItems((xs) => xs.filter((_, i) => i !== editing));
            setEditing(null);
          }}
        >
          Xoá từ này
        </Btn>
      </Dialog>

      {big && (
        <div className="scrim" style={{ background: "var(--surface)", flexDirection: "column", gap: 24 }} onClick={() => setBig(false)}>
          <div style={{ position: "absolute", top: 20, right: 20 }}>
            <IconBtn icon={X} label="Đóng" onClick={() => setBig(false)} />
          </div>
          <p className="d3" style={{ textAlign: "center", fontSize: "clamp(36px, 10vw, 72px)", margin: 0, color: "var(--txt)" }}>
            {text}
          </p>
          <span className="bm">Chạm để đóng</span>
        </div>
      )}
    </main>
  );
}
