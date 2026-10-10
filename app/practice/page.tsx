"use client";

import CameraError from "@/components/CameraError";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Camera, Eye, RotateCcw, SkipForward, Lightbulb, Award, Info, ChevronLeft } from "lucide-react";
import { useSignPractice } from "@/lib/useSignPractice";
import { CONFIDENCE_THRESHOLD } from "@/lib/constants";
import { recordAttempt, loadProgress, countLearned } from "@/lib/progress";
import { findLesson } from "@/lib/lessons";
import { useLabels } from "@/lib/useLabels";
import { practiceUrl, lessonUrl } from "@/lib/nav";
import { signal } from "@/lib/feedback";
import { BADGES, earnedBadgeIds } from "@/lib/badges";
import { loadProfile } from "@/lib/profile";
import type { Prediction } from "@/lib/classifier";
import CameraStage from "@/components/CameraStage";
import SampleMedia from "@/components/SampleMedia";
import Flash from "@/components/Flash";
import SaveBtn from "@/components/SaveBtn";
import { Bar, Btn, IconBtn, IconCircle, Pill, Ring, Segmented } from "@/components/ui";

function PracticeInner() {
  const params = useSearchParams();
  const router = useRouter();
  const target = params.get("word") ?? "";
  const lessonId = params.get("lesson") ?? "";

  const { videoRef, canvasRef, phase, count, handsVisible, hint, modelReady, cameraError, start } = useSignPractice();

  const [pred, setPred] = useState<Prediction | null>(null);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState<"demo" | "practice">("demo");
  const [newBadge, setNewBadge] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "no" | null; tick: number }>({ kind: null, tick: 0 });
  const slow = typeof window !== "undefined" ? loadProfile().slowVideo : false;

  useEffect(() => {
    if (!newBadge) return;
    const t = setTimeout(() => setNewBadge(null), 5000);
    return () => clearTimeout(t);
  }, [newBadge]);

  const { labels } = useLabels();
  const lesson = useMemo(() => (lessonId ? findLesson(labels, lessonId) : undefined), [labels, lessonId]);
  const idx = lesson ? lesson.words.indexOf(target) : -1;
  const nextWord = lesson && idx >= 0 && idx + 1 < lesson.words.length ? lesson.words[idx + 1] : null;

  const onStart = async () => {
    setPred(null);
    setDone(false);
    const result = await start();
    setPred(result);
    if (result) {
      const ok = result.label === target && result.confidence >= CONFIDENCE_THRESHOLD;
      const before = loadProgress();
      const badgesBefore = earnedBadgeIds(before, countLearned(before, labels));
      const after = recordAttempt(target, ok);
      const prof = loadProfile();
      signal(ok, { sound: after.soundOn, vibrate: prof.vibrate });
      if (prof.flash) setFlash((f) => ({ kind: ok ? "ok" : "no", tick: f.tick + 1 }));
      const badgesAfter = earnedBadgeIds(after, countLearned(after, labels));
      const fresh = [...badgesAfter].find((id) => !badgesBefore.has(id));
      if (fresh) setNewBadge(fresh);
      setDone(true);
    }
  };

  const goTo = (word: string) => {
    setPred(null);
    setDone(false);
    setStep("demo");
    setNewBadge(null);
    router.push(practiceUrl(word, lessonId || undefined));
  };

  const correct = !!pred && pred.label === target && pred.confidence >= CONFIDENCE_THRESHOLD;
  const confPct = pred ? Math.round(pred.confidence * 100) : 0;
  const badge = BADGES.find((b) => b.id === newBadge);
  const busy = phase === "loading" || phase === "countdown" || phase === "recording";

  return (
    <main className="app" style={{ gap: 18 }}>
      <Flash kind={flash.kind} tick={flash.tick} />
      {badge && (
        <button type="button" className="toast" onClick={() => setNewBadge(null)} style={{ border: "none", textAlign: "left" }}>
          <IconCircle icon={Award} bg="var(--yel)" fg="var(--yel-txt)" />
          <span className="col col--tight">
            <span className="bb">Huy hiệu mới: {badge.title}</span>
            <span className="sm">{badge.desc}</span>
          </span>
        </button>
      )}

      <div className="topbar" style={{ gap: 14 }}>
        <IconBtn icon={ChevronLeft} label="Quay lại" onClick={() => router.push(lesson ? lessonUrl(lesson.id) : "/tu-dien")} />
        <div className="col col--tight grow">
          <span className="sm">{lesson ? `${lesson.title} · ${idx + 1}/${lesson.words.length}` : "Luyện ký hiệu"}</span>
          {lesson && <Bar pct={((idx + (correct ? 1 : 0)) / lesson.words.length) * 100} h={8} />}
        </div>
        {target && <SaveBtn word={target} />}
      </div>

      <div className="col col--tight">
        <span className="bm">{step === "demo" ? "Xem mẫu rồi làm theo" : "Đến lượt bạn ký"}</span>
        <h1 className="d4">{target || "—"}</h1>
      </div>

      <Segmented
        label="Bước"
        value={step}
        onChange={(v) => setStep(v)}
        items={[
          { v: "demo", label: "1 · Xem mẫu" },
          { v: "practice", label: "2 · Tập & chấm" },
        ]}
      />

      {step === "demo" ? (
        <>
          <SampleMedia word={target} slow={slow} />
          <div className="card" style={{ gap: 10 }}>
            <div className="row">
              <IconCircle icon={Lightbulb} size={36} bg="var(--yel-soft)" fg="var(--yel-txt)" square />
              <span className="bb">Mẹo để camera chấm chuẩn</span>
            </div>
            {["Đứng cách điện thoại khoảng 1 mét, đủ sáng", "Giữ cả hai tay trong khung nét đứt", "Bấm Bắt đầu, đếm 3-2-1 rồi ký trong khoảng 2,5 giây"].map((t, i) => (
              <div key={t} className="row" style={{ gap: 10 }}>
                <span className="icon-circle" style={{ width: 26, height: 26, background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 13 }}>
                  {i + 1}
                </span>
                <span className="bm" style={{ color: "var(--txt)" }}>
                  {t}
                </span>
              </div>
            ))}
          </div>
          <Btn icon={Camera} onClick={() => setStep("practice")}>
            Tập trước camera
          </Btn>
        </>
      ) : (
        <>
          <CameraStage videoRef={videoRef} canvasRef={canvasRef} phase={phase} count={count} handsVisible={handsVisible} hint={hint} error={!!cameraError} />

          {cameraError && <CameraError note="Bạn vẫn xem được video mẫu." />}
          {!modelReady && !cameraError && phase !== "loading" && (
            <div className="tile t-yel" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Info size={22} color="var(--yel-txt)" aria-hidden />
              <span className="bm" style={{ color: "var(--txt)" }}>
                Chưa tải được mô hình AI nên chưa chấm điểm. Khung xương tay vẫn hoạt động.
              </span>
            </div>
          )}

          {pred && (
            <section className="card card--row" aria-live="polite" style={{ border: `2.5px solid ${correct ? "var(--grn)" : "var(--red)"}` }}>
              <Ring pct={confPct} color={correct ? "var(--grn)" : "var(--org)"} size={76} thick={9}>
                <span className="bb">{confPct}%</span>
              </Ring>
              <div className="col col--tight grow">
                <span className="h4">{correct ? "Đúng rồi! +10 XP" : "Chưa đúng"}</span>
                <span className="bm">
                  {correct ? "Ký hiệu rõ ràng, tiếp tục nào." : (
                    <>
                      AI nhận ra: <b style={{ color: "var(--txt)" }}>{pred.label}</b>. Xem lại mẫu rồi thử lần nữa.
                    </>
                  )}
                </span>
              </div>
            </section>
          )}
          {phase === "result" && !pred && modelReady && (
            <section className="tile t-org" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Info size={22} color="var(--org-txt)" aria-hidden />
              <span className="bm" style={{ color: "var(--txt)" }}>
                Không thấy tay trong lúc ghi. Đưa tay vào khung rồi thử lại.
              </span>
            </section>
          )}

          {correct && lesson ? (
            nextWord ? (
              <Btn level="positive" icon={SkipForward} onClick={() => goTo(nextWord)}>
                Từ tiếp theo: {nextWord}
              </Btn>
            ) : (
              <Btn level="positive" href={lessonUrl(lesson.id)}>
                Hoàn thành “{lesson.title}”
              </Btn>
            )
          ) : (
            <Btn icon={done ? RotateCcw : Camera} onClick={onStart} disabled={busy || !!cameraError}>
              {cameraError ? "Chưa mở được camera" : phase === "loading" ? "Đang mở camera…" : phase === "countdown" ? `Chuẩn bị… ${count}` : phase === "recording" ? "Đang ghi…" : done ? "Thử lại" : "Bắt đầu ký"}
            </Btn>
          )}
          <div className="row">
            <Btn level="tertiary" size="md" icon={Eye} onClick={() => setStep("demo")}>
              Xem lại mẫu
            </Btn>
            {nextWord && !correct && (
              <Btn level="tertiary" size="md" icon={SkipForward} onClick={() => goTo(nextWord)}>
                Bỏ qua
              </Btn>
            )}
          </div>
          {pred && !correct && (
            <Pill bg="var(--neu)" fg="var(--txt2)" icon={Info} style={{ alignSelf: "center", whiteSpace: "normal" }}>
              Cần đúng từ và độ tin cậy từ {Math.round(CONFIDENCE_THRESHOLD * 100)}%. AI có thể nhận nhầm, nhất là khi thiếu sáng hoặc tay ra khỏi khung.
            </Pill>
          )}
        </>
      )}
    </main>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<main className="app">Đang tải…</main>}>
      <PracticeInner />
    </Suspense>
  );
}
