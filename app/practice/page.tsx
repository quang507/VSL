"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Camera, Eye, SkipForward, Lightbulb, Award, Info, ChevronLeft } from "lucide-react";
import { CONFIDENCE_THRESHOLD, MODEL_URL, LABELS_URL, WORD_FEATURES } from "@/lib/constants";
import { recordAttempt, loadProgress, countLearned } from "@/lib/progress";
import { findLesson } from "@/lib/lessons";
import { useLabels } from "@/lib/useLabels";
import { practiceUrl, lessonUrl } from "@/lib/nav";
import { signal } from "@/lib/feedback";
import { BADGES, earnedBadgeIds } from "@/lib/badges";
import { loadProfile } from "@/lib/profile";
import type { Prediction } from "@/lib/classifier";
import SignCapture from "@/components/SignCapture";
import LoopVideo from "@/components/LoopVideo";
import CameraStage from "@/components/CameraStage";
import { useSignPractice } from "@/lib/useSignPractice";
import { useAutoAdvance } from "@/lib/useAutoAdvance";
import SampleMedia from "@/components/SampleMedia";
import Flash from "@/components/Flash";
import SaveBtn from "@/components/SaveBtn";
import { Bar, Btn, IconBtn, IconCircle, Pill, Ring, Segmented } from "@/components/ui";

function MirrorPractice({ word, onGoPractice }: { word: string; onGoPractice: () => void }) {
  const { videoRef, canvasRef, handsVisible, hint, cameraError } = useSignPractice(MODEL_URL, LABELS_URL, WORD_FEATURES);
  const slow = typeof window !== "undefined" ? loadProfile().slowVideo : false;

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="tile t-blu" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 24 }} aria-hidden>
          🪞
        </span>
        <span className="bm" style={{ color: "var(--txt)" }}>
          <strong>Chế độ Soi Gương:</strong> Vừa xem video mẫu vừa nhìn dáng tay của bạn để uốn nắn từng ngón tay. Chế độ này <strong>hoàn toàn không chấm điểm</strong>, giúp bạn luyện tập tự nhiên không áp lực.
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, alignItems: "start" }}>
        <div className="col col--tight">
          <span className="eyebrow">1. Video mẫu ({word})</span>
          <SampleMedia word={word} slow={slow} aspect="4 / 3" />
        </div>
        <div className="col col--tight">
          <span className="eyebrow">2. Gương soi của bạn (MediaPipe)</span>
          <CameraStage
            videoRef={videoRef}
            canvasRef={canvasRef}
            phase="ready"
            count={0}
            handsVisible={handsVisible}
            hint={hint}
            error={!!cameraError}
          />
        </div>
      </div>

      <Btn icon={Camera} onClick={onGoPractice}>
        Đã thuộc động tác → Vào thi chấm điểm
      </Btn>
    </div>
  );
}

function PracticeInner() {
  const params = useSearchParams();
  const router = useRouter();
  const target = params.get("word") ?? "";
  const lessonId = params.get("lesson") ?? "";

  const [pred, setPred] = useState<Prediction | null>(null);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState<"demo" | "mirror" | "practice">("demo");
  const [newBadge, setNewBadge] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "no" | null; tick: number }>({ kind: null, tick: 0 });
  const slow = typeof window !== "undefined" ? loadProfile().slowVideo : false;
  const auto = typeof window !== "undefined" ? loadProfile().autoSign : true;

  useEffect(() => {
    if (!newBadge) return;
    const t = setTimeout(() => setNewBadge(null), 5000);
    return () => clearTimeout(t);
  }, [newBadge]);

  useEffect(() => {
    setPred(null);
    setDone(false);
  }, [target]);

  const { labels } = useLabels();
  const lesson = useMemo(() => (lessonId ? findLesson(labels, lessonId) : undefined), [labels, lessonId]);
  const idx = lesson ? lesson.words.indexOf(target) : -1;
  const nextWord = lesson && idx >= 0 && idx + 1 < lesson.words.length ? lesson.words[idx + 1] : null;

  // Một lần ký vừa được chấm (tự chấm hoặc bấm nút). null = không thấy tay.
  const onResult = (result: Prediction | null) => {
    setPred(result);
    setDone(false);
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

  // stay = giữ nguyên bước camera (tự chấm: sang từ mới là ký luôn, video mẫu nằm ở góc khung)
  const goTo = (word: string, stay = false) => {
    setPred(null);
    setDone(false);
    setStep(stay ? "practice" : "demo");
    setNewBadge(null);
    router.push(practiceUrl(word, lessonId || undefined));
  };

  const correct = !!pred && pred.label === target && pred.confidence >= CONFIDENCE_THRESHOLD;
  // Ký đúng ở chế độ tự chấm → đếm 3 giây rồi tự sang từ tiếp theo (huỷ được)
  const adv = useAutoAdvance(auto && correct && !!lesson && !!nextWord, () => nextWord && goTo(nextWord, true));
  // Bấm "Ở lại từ này" là muốn tập tiếp → mở lại camera chấm, không khoá nữa
  const stayed = auto && correct && !!lesson && !!nextWord && !adv.counting;
  const confPct = pred ? Math.round(pred.confidence * 100) : 0;
  const badge = BADGES.find((b) => b.id === newBadge);

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
        <span className="bm">
          {step === "demo" ? "Xem mẫu rồi làm theo" : step === "mirror" ? "Soi gương và uốn nắn dáng tay (không chấm điểm)" : "Đến lượt bạn ký (AI tự chấm)"}
        </span>
        <h1 className="d4">{target || "—"}</h1>
      </div>

      <Segmented
        label="Bước"
        value={step}
        onChange={(v) => setStep(v as "demo" | "mirror" | "practice")}
        items={[
          { v: "demo", label: "1 · Xem mẫu" },
          { v: "mirror", label: "2 · Soi gương" },
          { v: "practice", label: "3 · Tập & chấm" },
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
            {[
              "Lùi ra khoảng 1 mét, đủ sáng, để máy thấy từ đầu đến bụng",
              "Ký đủ cả hai tay như trong mẫu, kể cả tay đặt yên",
              auto ? "Cứ ký theo mẫu, app tự chấm khi bạn dừng tay. Không cần bấm nút" : "Bấm Bắt đầu, đếm 3-2-1 rồi ký trong khoảng 2,5 giây",
            ].map((t, i) => (
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
          <div className="row" style={{ gap: 10 }}>
            <Btn icon={Camera} onClick={() => setStep("practice")} style={{ flex: 1 }}>
              Tập trước camera
            </Btn>
            <button
              type="button"
              className="btn btn--secondary btn--lg"
              onClick={() => setStep("mirror")}
              style={{ flex: 1, minHeight: 48, fontWeight: 700 }}
            >
              🪞 Soi gương 50/50
            </button>
          </div>
        </>
      ) : step === "mirror" ? (
        <MirrorPractice word={target} onGoPractice={() => setStep("practice")} />
      ) : (
        <>
          <SignCapture
            modelUrl={MODEL_URL}
            labelsUrl={LABELS_URL}
            features={WORD_FEATURES}
            onResult={onResult}
            locked={correct && !!lesson && !stayed}
            attempted={done}
            errorNote="Bạn vẫn xem được video mẫu."
            corner={target ? <LoopVideo word={target} label={`Video mẫu “${target}”`} style={{ width: "100%", height: "100%", borderRadius: 0 }} /> : undefined}
          />

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
          {correct && lesson ? (
            nextWord ? (
              <>
                <Btn level="positive" icon={SkipForward} onClick={() => goTo(nextWord, auto)}>
                  Từ tiếp theo: {nextWord}
                  {adv.counting ? ` · ${adv.left}` : ""}
                </Btn>
                {adv.counting && (
                  <Btn level="ghost" size="sm" onClick={adv.cancel}>
                    Ở lại từ này
                  </Btn>
                )}
              </>
            ) : (
              <Btn level="positive" href={lessonUrl(lesson.id)}>
                Hoàn thành “{lesson.title}”
              </Btn>
            )
          ) : null}
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Btn level="tertiary" size="md" icon={Eye} onClick={() => setStep("demo")}>
              Xem lại mẫu
            </Btn>
            <button
              type="button"
              className="btn btn--tertiary btn--md"
              onClick={() => setStep("mirror")}
              style={{ minHeight: 44, fontWeight: 600 }}
            >
              🪞 Soi gương 50/50
            </button>
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
