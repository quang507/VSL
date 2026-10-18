"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Camera, Eye, SkipForward, Lightbulb, Award, Info, ChevronLeft, Volume2, Share2, Video, RotateCcw, Play } from "lucide-react";
import { CONFIDENCE_THRESHOLD, MODEL_URL, LABELS_URL, WORD_FEATURES } from "@/lib/constants";
import { recordAttempt, loadProgress, countLearned } from "@/lib/progress";
import { findLesson } from "@/lib/lessons";
import { useLabels } from "@/lib/useLabels";
import { practiceUrl, lessonUrl } from "@/lib/nav";
import { signal, speakVietnamese, fireConfetti } from "@/lib/feedback";
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
  const { videoRef, canvasRef, handsVisible, hint, cameraError, stalled, resumeCamera } = useSignPractice(MODEL_URL, LABELS_URL, WORD_FEATURES);
  const slow = typeof window !== "undefined" ? loadProfile().slowVideo : false;
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const recordedUrlRef = useRef<string | null>(null);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanupRecordedUrl = () => {
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = null;
    }
    setRecordedUrl(null);
  };

  useEffect(() => {
    return () => {
      if (recordTimeoutRef.current) clearTimeout(recordTimeoutRef.current);
      const mr = mediaRecorderRef.current;
      if (mr) {
        // Tháo handler TRƯỚC khi stop: onstop chạy bất đồng bộ sau khi đã unmount,
        // sẽ tạo Blob URL không ai revoke và setState trên component đã chết.
        mr.ondataavailable = null;
        mr.onstop = null;
        if (mr.state !== "inactive") mr.stop();
        mediaRecorderRef.current = null;
      }
      chunksRef.current = [];
      if (recordedUrlRef.current) {
        URL.revokeObjectURL(recordedUrlRef.current);
        recordedUrlRef.current = null;
      }
    };
  }, []);

  const startSelfRecord = () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    try {
      chunksRef.current = [];
      let mimeType = "";
      if (typeof MediaRecorder !== "undefined") {
        if (typeof MediaRecorder.isTypeSupported === "function") {
          if (MediaRecorder.isTypeSupported("video/webm")) mimeType = "video/webm";
          else if (MediaRecorder.isTypeSupported("video/mp4")) mimeType = "video/mp4";
        }
      }
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        cleanupRecordedUrl();
        const type = mr.mimeType || mimeType || "video/webm";
        const blob = new Blob(chunksRef.current, { type });
        const newUrl = URL.createObjectURL(blob);
        recordedUrlRef.current = newUrl;
        setRecordedUrl(newUrl);
        setRecording(false);
      };
      mr.start();
      setRecording(true);
      if (recordTimeoutRef.current) clearTimeout(recordTimeoutRef.current);
      recordTimeoutRef.current = setTimeout(() => {
        if (mr.state === "recording") mr.stop();
      }, 3000);
    } catch {
      setRecording(false);
    }
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="tile t-blu" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 24 }} aria-hidden>
          🪞
        </span>
        <span className="bm" style={{ color: "var(--txt)" }}>
          <strong>Chế độ Soi Gương & Đối chiếu clip (Lingvano):</strong> Vừa xem video mẫu vừa soi gương tay, hoặc tự bấm quay clip 3 giây để đặt cạnh người mẫu so khớp góc khuỷu tay và tư thế.
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, alignItems: "start" }}>
        <div className="col col--tight">
          <span className="eyebrow">1. Video mẫu ({word})</span>
          <SampleMedia word={word} slow={slow} aspect="4 / 3" />
        </div>
        <div className="col col--tight">
          <span className="eyebrow">2. {recordedUrl ? "Clip của bạn (Đối chiếu)" : "Gương soi trực tiếp"}</span>
          {recordedUrl ? (
            <div style={{ aspectRatio: "4 / 3", background: "#111", borderRadius: 20, overflow: "hidden", position: "relative" }}>
              <video
                src={recordedUrl}
                autoPlay
                loop
                muted
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <button
                type="button"
                className="btn btn--secondary"
                style={{
                  position: "absolute",
                  bottom: 10,
                  right: 10,
                  minHeight: 44,
                  minWidth: 44,
                  padding: "0 14px",
                  background: "rgba(0,0,0,0.7)",
                  color: "#fff",
                  borderColor: "transparent",
                  fontWeight: 600,
                  fontSize: 13,
                }}
                onClick={cleanupRecordedUrl}
              >
                <RotateCcw size={16} aria-hidden /> Soi trực tiếp
              </button>
            </div>
          ) : (
            <CameraStage
              videoRef={videoRef}
              canvasRef={canvasRef}
              phase="ready"
              count={0}
              handsVisible={handsVisible}
              hint={hint}
              error={!!cameraError}
              stalled={stalled}
              onResume={resumeCamera}
            />
          )}
        </div>
      </div>

      <div className="row" style={{ gap: 10 }}>
        {!recordedUrl && (
          <button
            type="button"
            className="btn btn--secondary btn--lg"
            style={{ flex: 1, minHeight: 48, fontWeight: 700, borderColor: recording ? "var(--red)" : undefined, color: recording ? "var(--red-txt)" : undefined }}
            onClick={startSelfRecord}
            disabled={recording}
          >
            <Video size={20} aria-hidden /> {recording ? "Đang quay 3 giây…" : "Quay 3 giây để đối chiếu"}
          </button>
        )}
        <Btn icon={Camera} onClick={onGoPractice} style={{ flex: 1 }}>
          Đã thuộc động tác → Vào thi chấm điểm
        </Btn>
      </div>
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
      if (ok) fireConfetti();
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

  const shareWord = async () => {
    if (typeof window === "undefined" || !target) return;
    const url = window.location.href;
    const shareData = {
      title: `Học ký hiệu từ: ${target}`,
      text: `Cùng học từ ngôn ngữ ký hiệu “${target}” với tôi nhé!`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert("Đã sao chép link bài học để gửi cho người thân!");
      } catch {}
    }
  };

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
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="icon-circle"
            style={{ width: 44, height: 44, border: "none", background: "var(--surface)", boxShadow: "var(--shadow-tile)", color: "var(--txt)" }}
            onClick={shareWord}
            aria-label="Chia sẻ bài học cho người thân"
          >
            <Share2 size={20} aria-hidden />
          </button>
          {target && <SaveBtn word={target} />}
        </div>
      </div>

      <div className="col col--tight">
        <span className="bm">
          {step === "demo" ? "Xem mẫu rồi làm theo" : step === "mirror" ? "Soi gương và uốn nắn dáng tay (không chấm điểm)" : "Đến lượt bạn ký (AI tự chấm)"}
        </span>
        <div className="row" style={{ gap: 12, alignItems: "center" }}>
          <h1 className="d4" style={{ margin: 0 }}>{target || "—"}</h1>
          {target && (
            <button
              type="button"
              className="icon-circle"
              style={{ width: 44, height: 44, border: "none", background: "var(--brand-soft)", color: "var(--acc)", flex: "none" }}
              onClick={() => speakVietnamese(target)}
              aria-label={`Nghe phát âm từ “${target}”`}
            >
              <Volume2 size={22} aria-hidden />
            </button>
          )}
        </div>
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
          <div className="card" style={{ gap: 12, padding: "16px 18px", background: "var(--surface)", boxShadow: "var(--shadow-tile)" }}>
            <div className="row row--between" style={{ alignItems: "center" }}>
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <IconCircle icon={Lightbulb} size={36} bg="var(--yel-soft)" fg="var(--yel-txt)" square />
                <span className="bb">Tập rảnh tay (Hands-free)</span>
              </div>
              <span className="badge badge--s badge--acc">Mẹo thông minh</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="col" style={{ gap: 4, background: "var(--canvas)", padding: "10px 12px", borderRadius: 14 }}>
                <span style={{ fontSize: 22 }}>👋</span>
                <span className="bb" style={{ fontSize: 13, color: "var(--acc)" }}>Vẫy tay bắt đầu</span>
                <span className="sm" style={{ fontSize: 12, color: "var(--txt2)", lineHeight: 1.3 }}>
                  Vẫy bàn tay xoè qua lại trước camera để máy tự đếm nhịp quay.
                </span>
              </div>
              <div className="col" style={{ gap: 4, background: "var(--canvas)", padding: "10px 12px", borderRadius: 14 }}>
                <span style={{ fontSize: 22 }}>🧍‍♂️</span>
                <span className="bb" style={{ fontSize: 13, color: "var(--acc)" }}>Lùi 1 mét</span>
                <span className="sm" style={{ fontSize: 12, color: "var(--txt2)", lineHeight: 1.3 }}>
                  Đứng đủ xa để camera nhìn thấy từ đầu đến bụng và hai bàn tay.
                </span>
              </div>
            </div>
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

          {/* Báo hiệu thị giác góc rộng (Far-Distance Feedback Banner) cho người Điếc đứng xa 1.5m */}
          {pred && (
            <div
              style={{
                width: "100%",
                padding: "16px 20px",
                borderRadius: 20,
                background: correct ? "var(--pos)" : "var(--neg)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: correct
                  ? "0 10px 30px rgba(0, 99, 38, 0.35)"
                  : "0 10px 30px rgba(149, 19, 0, 0.35)",
                animation: "pop 0.25s ease-out",
              }}
              aria-live="assertive"
            >
              <div className="row" style={{ gap: 14, alignItems: "center" }}>
                <span
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 26,
                  }}
                  aria-hidden
                >
                  {correct ? "✓" : "✗"}
                </span>
                <div className="col col--tight">
                  <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
                    {correct ? "CHÍNH XÁC! +10 XP" : "CHƯA ĐÚNG"}
                  </span>
                  <span style={{ fontSize: 14, opacity: 0.9 }}>
                    {correct ? `Ký chuẩn: ${target}` : `AI nhận thấy: ${pred.label}`}
                  </span>
                </div>
              </div>
              <span style={{ fontSize: 24, fontWeight: 800 }}>{confPct}%</span>
            </div>
          )}

          {pred && !correct && (
            <section className="card card--row" aria-live="polite" style={{ border: `2.5px solid var(--red)` }}>
              <Ring pct={confPct} color="var(--org)" size={76} thick={9}>
                <span className="bb">{confPct}%</span>
              </Ring>
              <div className="col col--tight grow">
                <span className="h4">Chưa đúng</span>
                <div className="col" style={{ gap: 6, marginTop: 2 }}>
                  <span className="bm" style={{ fontSize: 14 }}>
                    AI nhận ra: <b style={{ color: "var(--txt)" }}>{pred.label}</b> ({confPct}%)
                  </span>
                  <span className="sm" style={{ color: "var(--org-txt)", background: "var(--yel-soft)", padding: "6px 10px", borderRadius: 8, lineHeight: 1.4 }}>
                    💡 <b>Gợi ý uốn tay:</b> Đưa tay vào giữa khung hình, đối chiếu với video góc màn hình và giữ ổn định hình tay 1-2 giây.
                  </span>
                </div>
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
