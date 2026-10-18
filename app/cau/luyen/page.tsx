"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Camera, Eye, SkipForward, Info, ChevronLeft, MessageCircle, Volume2 } from "lucide-react";
import SignCapture from "@/components/SignCapture";
import { PHRASE_CONFIDENCE_THRESHOLD as CONFIDENCE_THRESHOLD } from "@/lib/constants";
import { recordAttempt } from "@/lib/progress";
import { signal, speakVietnamese, fireConfetti } from "@/lib/feedback";
import { loadProfile } from "@/lib/profile";
import { PHRASE_MODEL, PHRASE_LABELS, usePhrases, usePhraseDemo, phraseUrl, getPhraseMeta } from "@/lib/phrases";
import type { Prediction } from "@/lib/classifier";
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
  const meta = getPhraseMeta(target);
  const [step, setStep] = useState<"demo" | "practice">("demo");
  const [pred, setPred] = useState<Prediction | null>(null);
  const [done, setDone] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "no" | null; tick: number }>({ kind: null, tick: 0 });
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    };
  }, []);

  const correct = !!pred && pred.label === target && pred.confidence >= CONFIDENCE_THRESHOLD;
  const auto = typeof window !== "undefined" ? loadProfile().autoSign : true;

  const onResult = (r: Prediction | null) => {
    setPred(r);
    setDone(false);
    if (r) {
      const ok = r.label === target && r.confidence >= CONFIDENCE_THRESHOLD;
      const p = recordAttempt(target, ok);
      const prof = loadProfile();
      signal(ok, { sound: p.soundOn, vibrate: prof.vibrate });
      if (prof.flash) setFlash((f) => ({ kind: ok ? "ok" : "no", tick: f.tick + 1 }));
      if (ok) {
        fireConfetti();
        // Giả lập đối thoại trực tiếp: Người thân phản hồi bằng giọng nói
        if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
        replyTimerRef.current = setTimeout(() => speakVietnamese(meta.dialogue.partnerReply), 350);
      }
      setDone(true);
    }
  };
  const goTo = (n: number) => {
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
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
          {/* Tình huống đàm thoại 2 chiều */}
          <div className="card" style={{ gap: 8, background: "var(--surface)", borderLeft: "4px solid var(--pur)", padding: "12px 14px", borderRadius: 16 }}>
            <div className="row row--between" style={{ alignItems: "center" }}>
              <span className="sm" style={{ color: "var(--txt2)", fontWeight: 600 }}>Tình huống hội thoại mô phỏng</span>
              <button
                type="button"
                className="icon-circle"
                style={{ width: 44, height: 44, border: "none", background: "var(--pur-soft)", color: "var(--pur-txt)" }}
                onClick={() => speakVietnamese(meta.dialogue.partnerPrompt)}
                aria-label="Nghe người thân nói câu này"
              >
                <Volume2 size={20} aria-hidden />
              </button>
            </div>
            <span className="bb" style={{ color: "var(--txt)", fontSize: 15 }}>{meta.dialogue.partnerPrompt}</span>
          </div>

          <SkeletonDemo frames={frames} />

          {/* Hướng dẫn biểu cảm khuôn mặt (Non-manual markers) */}
          <div className="card" style={{ gap: 6, background: "var(--brand-soft)", borderColor: "transparent", padding: "14px 16px", borderRadius: 16 }}>
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <span className="badge badge--s" style={{ background: meta.expression.badgeBg, color: meta.expression.badgeFg }}>
                {meta.expression.badge}
              </span>
              <span className="h4" style={{ fontSize: 14 }}>Biểu cảm khuôn mặt đi kèm</span>
            </div>
            <span className="bm" style={{ color: "var(--txt)", fontSize: 14, lineHeight: 1.5 }}>
              {meta.expression.tip}
            </span>
          </div>

          <div className="tile t-blu" style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Info size={22} color="var(--acc)" aria-hidden style={{ flex: "none" }} />
            <span className="bm" style={{ color: "var(--txt)" }}>
              Xanh dương và xanh lá là hai bàn tay của người ký mẫu (nhìn từ phía camera). {auto ? "Ký liền cả câu, đừng dừng tay giữa chừng: app chấm khi bạn dừng tay." : "Ký liền cả câu trong khoảng 2,5 giây."}
            </span>
          </div>
          <Btn icon={Camera} onClick={() => setStep("practice")}>
            Tập trước camera
          </Btn>
        </>
      ) : (
        <>
          <SignCapture modelUrl={PHRASE_MODEL} labelsUrl={PHRASE_LABELS} onResult={onResult} locked={correct && next !== null} attempted={done} errorNote="Bạn vẫn xem được hoạt hình mẫu." />

          {/* Phản hồi đàm thoại 2 chiều khi ký đúng */}
          {correct && (
            <div className="card card--row" style={{ gap: 12, background: "var(--grn-soft)", borderColor: "var(--grn)", padding: "16px 18px", borderRadius: 20 }}>
              <span className="icon-circle" style={{ width: 44, height: 44, background: "var(--grn)", color: "#fff", flex: "none" }}>
                <MessageCircle size={22} aria-hidden />
              </span>
              <div className="col col--tight grow">
                <span className="sm" style={{ color: "var(--grn-txt)", fontWeight: 700 }}>Người thân đáp lại:</span>
                <span className="bb" style={{ fontSize: 16, color: "var(--txt)" }}>{meta.dialogue.partnerReply}</span>
              </div>
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
                  <div className="col" style={{ gap: 6, marginTop: 2 }}>
                    <span className="bm" style={{ fontSize: 14 }}>
                      AI nhận ra: <b style={{ color: "var(--txt)" }}>{pred.label}</b>
                    </span>
                    <span className="sm" style={{ color: "var(--org-txt)", background: "var(--yel-soft)", padding: "6px 10px", borderRadius: 8, lineHeight: 1.4 }}>
                      💡 <b>Gợi ý:</b> Ký liền mạch cả câu và giữ bàn tay trong khung hình suốt 2.5 giây.
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}
          {correct && next !== null ? (
            <Btn level="positive" icon={SkipForward} onClick={() => goTo(next)}>
              Câu tiếp theo
            </Btn>
          ) : null}
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
