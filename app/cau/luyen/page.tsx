"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Camera, Eye, RotateCcw, SkipForward, Info, ChevronLeft } from "lucide-react";
import { useSignPractice } from "@/lib/useSignPractice";
import { CONFIDENCE_THRESHOLD } from "@/lib/constants";
import { recordAttempt } from "@/lib/progress";
import { signal } from "@/lib/feedback";
import { loadProfile } from "@/lib/profile";
import { PHRASE_MODEL, PHRASE_LABELS, usePhrases, usePhraseDemo, phraseUrl } from "@/lib/phrases";
import type { Prediction } from "@/lib/classifier";
import CameraStage from "@/components/CameraStage";
import SkeletonDemo from "@/components/SkeletonDemo";
import Flash from "@/components/Flash";
import { Bar, Btn, IconBtn, Ring, Segmented } from "@/components/ui";

function Inner() {
  const router = useRouter();
  const i = Number(useSearchParams().get("i") ?? 0);
  const { labels } = usePhrases();
  const target = labels[i] ?? "";
  const next = i + 1 < labels.length ? i + 1 : null;
  const frames = usePhraseDemo(target);
  const { videoRef, canvasRef, phase, count, handsVisible, hint, modelReady, cameraError, start } = useSignPractice(PHRASE_MODEL, PHRASE_LABELS);
  const [step, setStep] = useState<"demo" | "practice">("demo");
  const [pred, setPred] = useState<Prediction | null>(null);
  const [done, setDone] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "no" | null; tick: number }>({ kind: null, tick: 0 });

  const correct = !!pred && pred.label === target && pred.confidence >= CONFIDENCE_THRESHOLD;
  const busy = phase === "loading" || phase === "countdown" || phase === "recording";

  const onStart = async () => {
    setPred(null);
    setDone(false);
    const r = await start();
    setPred(r);
    if (r) {
      const ok = r.label === target && r.confidence >= CONFIDENCE_THRESHOLD;
      const p = recordAttempt(target, ok);
      const prof = loadProfile();
      signal(ok, { sound: p.soundOn, vibrate: prof.vibrate });
      if (prof.flash) setFlash((f) => ({ kind: ok ? "ok" : "no", tick: f.tick + 1 }));
      setDone(true);
    }
  };
  const goTo = (n: number) => {
    setPred(null);
    setDone(false);
    setStep("demo");
    router.push(phraseUrl(n));
  };

  return (
    <main className="app" style={{ gap: 18 }}>
      <Flash kind={flash.kind} tick={flash.tick} />
      <div className="topbar" style={{ gap: 14 }}>
        <IconBtn icon={ChevronLeft} label="Quay lại" onClick={() => router.push("/cau")} />
        <div className="col col--tight grow">
          <span className="sm">
            Câu giao tiếp · {i + 1}/{labels.length || "…"}
          </span>
          <Bar pct={labels.length ? ((i + (correct ? 1 : 0)) / labels.length) * 100 : 0} h={8} color="var(--pur)" />
        </div>
      </div>
      <div className="col col--tight">
        <span className="bm">{step === "demo" ? "Xem mẫu rồi ký cả câu" : "Đến lượt bạn ký cả câu"}</span>
        <h1 className="h2">{target || "…"}</h1>
      </div>
      <Segmented
        label="Bước"
        value={step}
        onChange={setStep}
        items={[
          { v: "demo", label: "1 · Xem mẫu" },
          { v: "practice", label: "2 · Tập & chấm" },
        ]}
      />
      {step === "demo" ? (
        <>
          <SkeletonDemo frames={frames} />
          <div className="tile t-blu" style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Info size={22} color="var(--acc)" aria-hidden style={{ flex: "none" }} />
            <span className="bm" style={{ color: "var(--txt)" }}>
              Xanh dương và xanh lá là hai bàn tay của người ký mẫu (nhìn từ phía camera). Ký liền cả câu trong khoảng 2,5 giây.
            </span>
          </div>
          <Btn icon={Camera} onClick={() => setStep("practice")}>
            Tập trước camera
          </Btn>
        </>
      ) : (
        <>
          <CameraStage videoRef={videoRef} canvasRef={canvasRef} phase={phase} count={count} handsVisible={handsVisible} hint={hint} error={!!cameraError} />
          {!modelReady && !cameraError && phase !== "loading" && (
            <div className="tile t-yel" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Info size={22} color="var(--yel-txt)" aria-hidden />
              <span className="bm" style={{ color: "var(--txt)" }}>
                Chưa tải được mô hình câu giao tiếp.
              </span>
            </div>
          )}
          {pred && (
            <section className="card card--row" aria-live="polite" style={{ border: `2.5px solid ${correct ? "var(--grn)" : "var(--red)"}` }}>
              <Ring pct={Math.round(pred.confidence * 100)} color={correct ? "var(--grn)" : "var(--org)"} size={76} thick={9}>
                <span className="bb">{Math.round(pred.confidence * 100)}%</span>
              </Ring>
              <div className="col col--tight grow">
                <span className="h4">{correct ? "Đúng rồi! +10 XP" : "Chưa đúng"}</span>
                {!correct && (
                  <span className="bm">
                    AI nhận ra: <b style={{ color: "var(--txt)" }}>{pred.label}</b>
                  </span>
                )}
              </div>
            </section>
          )}
          {phase === "result" && !pred && modelReady && (
            <section className="tile t-org" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Info size={22} color="var(--org-txt)" aria-hidden />
              <span className="bm" style={{ color: "var(--txt)" }}>
                Không thấy tay đủ lâu trong lúc ghi. Đưa tay vào khung rồi thử lại.
              </span>
            </section>
          )}
          {correct && next !== null ? (
            <Btn level="positive" icon={SkipForward} onClick={() => goTo(next)}>
              Câu tiếp theo
            </Btn>
          ) : (
            <Btn icon={done ? RotateCcw : Camera} onClick={onStart} disabled={busy || !!cameraError}>
              {phase === "loading" ? "Đang mở camera…" : phase === "countdown" ? `Chuẩn bị… ${count}` : phase === "recording" ? "Đang ghi…" : done ? "Thử lại" : "Bắt đầu ký"}
            </Btn>
          )}
          <div className="row">
            <Btn level="tertiary" size="md" icon={Eye} onClick={() => setStep("demo")}>
              Xem lại mẫu
            </Btn>
            {next !== null && !correct && (
              <Btn level="tertiary" size="md" icon={SkipForward} onClick={() => goTo(next)}>
                Bỏ qua
              </Btn>
            )}
          </div>
        </>
      )}
    </main>
  );
}

export default function PhrasePractice() {
  return (
    <Suspense fallback={<main className="app">Đang tải…</main>}>
      <Inner />
    </Suspense>
  );
}
