"use client";

import { asset } from "@/lib/base";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { X, ArrowRight, SkipForward, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";
import { CONFIDENCE_THRESHOLD, MODEL_URL, LABELS_URL, WORD_FEATURES } from "@/lib/constants";
import SignCapture from "@/components/SignCapture";
import LoopVideo from "@/components/LoopVideo";
import { useAutoAdvance } from "@/lib/useAutoAdvance";
import { useLabels } from "@/lib/useLabels";
import { recordAttempt, loadProgress, dueWords, recordCheckpoint } from "@/lib/progress";
import { signal, fireConfetti } from "@/lib/feedback";
import { loadProfile } from "@/lib/profile";
import type { Prediction } from "@/lib/classifier";
import Flash from "@/components/Flash";
import { Bar, Btn, IconBtn, Pill, Ring, Sticker, Segmented } from "@/components/ui";

const QUIZ_LEN = 8;
type QuizMode = "choice" | "camera" | "match";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function QuizInner() {
  const searchParams = useSearchParams();
  const review = searchParams.get("mode") === "review";
  const checkpoint = searchParams.get("checkpoint");
  const router = useRouter();
  const { labels } = useLabels();

  const [deck, setDeck] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [pred, setPred] = useState<Prediction | null>(null);
  const [graded, setGraded] = useState(false);
  const [quizMode, setQuizMode] = useState<QuizMode>("choice");
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "no" | null; tick: number }>({ kind: null, tick: 0 });

  // State cho game nối cặp (Matching Pairs Mini-game)
  const [matchSet, setMatchSet] = useState<string[]>([]);
  const [matchedWords, setMatchedWords] = useState<string[]>([]);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [matchError, setMatchError] = useState(false);

  const buildDeck = (ls: string[]) => {
    if (review) return dueWords(loadProgress(), ls);
    if (checkpoint) return shuffle(ls).slice(0, 5); // 5 câu cho bài thi vượt chặng
    return shuffle(ls).slice(0, QUIZ_LEN);
  };

  useEffect(() => {
    if (labels.length) {
      setDeck(buildDeck(labels));
      setMatchSet(shuffle(labels).slice(0, 4));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels, review, checkpoint]);

  const target = deck[idx] ?? "";
  const finished = deck.length > 0 && idx >= deck.length;
  const score = results.filter(Boolean).length;

  const choices = useMemo(() => {
    if (!target || !labels.length) return [];
    const pool = labels.filter((l) => l !== target);
    const distractors = shuffle(pool).slice(0, 3);
    return shuffle([target, ...distractors]);
  }, [target, labels]);

  const onPickChoice = (choice: string) => {
    if (graded) return;
    setSelectedChoice(choice);
    const ok = choice === target;
    const p = recordAttempt(target, ok);
    const prof = loadProfile();
    signal(ok, { sound: p.soundOn, vibrate: prof.vibrate });
    if (prof.flash) setFlash((f) => ({ kind: ok ? "ok" : "no", tick: f.tick + 1 }));
    if (ok) fireConfetti();
    setResults((r) => [...r, ok]);
    setGraded(true);
  };

  const onResult = (result: Prediction | null) => {
    setPred(result);
    const ok = !!(result && result.label === target && result.confidence >= CONFIDENCE_THRESHOLD);
    if (result) {
      const p = recordAttempt(target, ok);
      const prof = loadProfile();
      signal(ok, { sound: p.soundOn, vibrate: prof.vibrate });
      if (prof.flash) setFlash((f) => ({ kind: ok ? "ok" : "no", tick: f.tick + 1 }));
      if (ok) fireConfetti();
    }
    setResults((r) => [...r, ok]);
    setGraded(true);
  };

  const next = () => {
    setIdx((i) => i + 1);
    setPred(null);
    setSelectedChoice(null);
    setGraded(false);
  };
  const skip = () => {
    setResults((r) => [...r, false]);
    next();
  };
  const restart = () => {
    setDeck(buildDeck(labels));
    setIdx(0);
    setResults([]);
    setPred(null);
    setSelectedChoice(null);
    setGraded(false);
  };

  const correct = quizMode === "camera"
    ? !!pred && pred.label === target && pred.confidence >= CONFIDENCE_THRESHOLD
    : selectedChoice === target;
  const auto = typeof window !== "undefined" ? loadProfile().autoSign : true;
  const adv = useAutoAdvance(auto && graded && correct && !finished, () => next());

  // R2 · Vượt chặng: đạt ≥80% thì ghi lại để mở khóa chặng kế trên bản đồ (bền qua tắt app đột ngột)
  useEffect(() => {
    if (finished && checkpoint && deck.length > 0) {
      const pct = Math.round((score / deck.length) * 100);
      if (pct >= 80) recordCheckpoint(checkpoint);
    }
  }, [finished, checkpoint, score, deck.length]);

  // Xử lý mini-game ghép cặp (Matching Pairs)
  const handleSelectText = (word: string) => {
    if (matchedWords.includes(word)) return;
    if (selectedVideo) {
      if (selectedVideo === word) {
        signal(true, { sound: true, vibrate: true });
        fireConfetti();
        setMatchedWords((prev) => [...prev, word]);
        setSelectedText(null);
        setSelectedVideo(null);
        recordAttempt(word, true);
      } else {
        signal(false, { sound: true, vibrate: true });
        setMatchError(true);
        setTimeout(() => {
          setSelectedText(null);
          setSelectedVideo(null);
          setMatchError(false);
        }, 500);
      }
    } else {
      setSelectedText(word);
    }
  };

  const handleSelectVideo = (word: string) => {
    if (matchedWords.includes(word)) return;
    if (selectedText) {
      if (selectedText === word) {
        signal(true, { sound: true, vibrate: true });
        fireConfetti();
        setMatchedWords((prev) => [...prev, word]);
        setSelectedText(null);
        setSelectedVideo(null);
        recordAttempt(word, true);
      } else {
        signal(false, { sound: true, vibrate: true });
        setMatchError(true);
        setTimeout(() => {
          setSelectedText(null);
          setSelectedVideo(null);
          setMatchError(false);
        }, 500);
      }
    } else {
      setSelectedVideo(word);
    }
  };

  if (review && labels.length > 0 && deck.length === 0)
    return (
      <main className="app app--center">
        <div className="topbar" style={{ width: "100%" }}>
          <IconBtn icon={X} label="Đóng" onClick={() => router.push("/luyen-tap")} />
        </div>
        <div className="grow" />
        <Sticker src={asset("/img/mascot_peace.png")} size={168} border="var(--grn-bd)" />
        <h1 className="h2">Chưa có từ nào đến hạn ôn</h1>
        <p className="bm" style={{ margin: 0 }}>
          Học thêm từ mới, rồi quay lại sau để ôn cho nhớ lâu nhé.
        </p>
        <div className="grow" />
        <Btn href="/">Học từ mới</Btn>
      </main>
    );

  if (finished) {
    const pct = Math.round((score / deck.length) * 100);
    return (
      <main className="app app--center" style={{ gap: 18 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cloud" src={asset("/img/cloud.png")} alt="" />
        <div className="grow" />
        <Pill bg={pct >= 80 ? "var(--grn-soft)" : "var(--org-soft)"} fg={pct >= 80 ? "var(--grn-txt)" : "var(--org-txt)"}>
          {checkpoint ? "Vượt chặng thành công!" : review ? "Hoàn thành phiên ôn" : "Hoàn thành đố vui"}
        </Pill>
        <Ring pct={pct} color={pct >= 80 ? "var(--grn)" : "var(--org)"} size={176} thick={18}>
          <span className="d3">{pct}%</span>
          <span className="sm">
            {score}/{deck.length} câu đúng
          </span>
        </Ring>
        <h1 className="d4">{checkpoint ? (pct >= 80 ? "Đạt chuẩn vượt chặng!" : "Chưa đạt, hãy thử lại!") : pct === 100 ? "Tuyệt đối!" : pct >= 80 ? "Giỏi lắm!" : pct >= 50 ? "Khá lắm!" : "Cố lên nhé!"}</h1>
        <p className="bm" style={{ margin: 0 }}>
          {checkpoint ? "Bạn đã thành thạo chặng học này và mở khóa bài học kế tiếp!" : pct >= 80 ? "Bạn nhớ ký hiệu rất tốt." : "Xem lại mẫu những từ sai rồi thử lại."}
        </p>
        <div className="card" style={{ width: "100%", textAlign: "left" }}>
          {deck.map((w, i) => (
            <div key={w} className="row row--between">
              <span className="bm" style={{ color: "var(--txt)" }}>
                {w}
              </span>
              <Pill bg={results[i] ? "var(--grn-soft)" : "var(--red-soft)"} fg={results[i] ? "var(--grn-txt)" : "var(--red-txt)"}>
                {results[i] ? "Đúng" : "Sai"}
              </Pill>
            </div>
          ))}
        </div>
        <div className="grow" />
        <Btn icon={RotateCcw} onClick={restart}>
          {checkpoint ? "Thi lại chặng" : review ? "Ôn lại" : "Chơi lại"}
        </Btn>
        <Btn level="tertiary" href="/">
          Về Lộ trình
        </Btn>
      </main>
    );
  }

  return (
    <main className="app" style={{ gap: 16 }}>
      <Flash kind={flash.kind} tick={flash.tick} />
      <div className="topbar" style={{ gap: 14 }}>
        <IconBtn icon={X} label="Đóng" onClick={() => router.push(checkpoint ? "/" : "/luyen-tap")} />
        <Bar pct={deck.length ? (idx / deck.length) * 100 : 0} h={12} />
        <Pill bg="var(--grn-soft)" fg="var(--grn-txt)">
          {score} đúng
        </Pill>
      </div>

      {checkpoint && (
        <div className="tile t-yel" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🛡️</span>
          <span className="bm" style={{ color: "var(--txt)" }}>
            <strong>Bài thi vượt chặng (Unit Checkpoint Exam):</strong> Hoàn thành $\ge 80\%$ để mở khóa các chặng tiếp theo trên bản đồ.
          </span>
        </div>
      )}

      <Segmented<QuizMode>
        label="Dạng bài tập"
        value={quizMode}
        onChange={(m) => {
          setQuizMode(m);
          setGraded(false);
          setSelectedChoice(null);
          setPred(null);
        }}
        items={[
          { v: "choice", label: "Đoán từ" },
          { v: "match", label: "Ghép cặp" },
          { v: "camera", label: "Ký camera" },
        ]}
      />

      <div className="row" style={{ gap: 6 }} aria-hidden>
        {deck.map((_, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 99,
              background: i === idx && !graded ? "var(--brand)" : results[i] === true ? "var(--grn)" : results[i] === false ? "var(--red)" : "var(--neu)",
            }}
          />
        ))}
      </div>

      {quizMode === "match" ? (
        <section className="col" style={{ gap: 16 }} aria-label="Ghép cặp phản xạ">
          <div className="col col--tight">
            <span className="eyebrow" style={{ color: "var(--acc)" }}>Mini-game Lingvano</span>
            <h1 className="h3" style={{ margin: 0 }}>Nối từ và video tương ứng</h1>
            <span className="sm" style={{ color: "var(--txt2)" }}>
              Chạm vào 1 từ và 1 video cử chỉ để tạo thành cặp đúng.
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Cột trái: Từ vựng */}
            <div className="col" style={{ gap: 10 }}>
              <span className="eyebrow" style={{ textAlign: "center" }}>Từ vựng</span>
              {matchSet.map((w) => {
                const isMatched = matchedWords.includes(w);
                const isSelected = selectedText === w;
                return (
                  <button
                    key={`txt-${w}`}
                    type="button"
                    onClick={() => handleSelectText(w)}
                    disabled={isMatched}
                    className="card"
                    style={{
                      minHeight: 52,
                      padding: "12px 14px",
                      textAlign: "center",
                      justifyContent: "center",
                      alignItems: "center",
                      border: isMatched
                        ? "2px solid var(--pos)"
                        : isSelected
                        ? matchError
                          ? "2px solid var(--neg)"
                          : "2px solid var(--brand)"
                        : "1.5px solid var(--line)",
                      background: isMatched
                        ? "var(--pos-soft)"
                        : isSelected
                        ? matchError
                          ? "var(--neg-soft)"
                          : "var(--brand-soft)"
                        : "var(--surface)",
                      color: isMatched ? "var(--pos-txt)" : isSelected ? "var(--brand)" : "var(--txt)",
                      fontWeight: 700,
                      opacity: isMatched ? 0.6 : 1,
                      transition: "all 0.2s ease",
                      boxShadow: "var(--shadow-tile)",
                    }}
                    aria-label={`Từ ${w} ${isMatched ? "đã ghép" : isSelected ? "đang chọn" : ""}`}
                  >
                    {isMatched ? `✓ ${w}` : w}
                  </button>
                );
              })}
            </div>

            {/* Cột phải: Video cử chỉ */}
            <div className="col" style={{ gap: 10 }}>
              <span className="eyebrow" style={{ textAlign: "center" }}>Cử chỉ</span>
              {matchSet.map((w) => {
                const isMatched = matchedWords.includes(w);
                const isSelected = selectedVideo === w;
                return (
                  <button
                    key={`vid-${w}`}
                    type="button"
                    onClick={() => handleSelectVideo(w)}
                    disabled={isMatched}
                    style={{
                      height: 52,
                      padding: 4,
                      borderRadius: 16,
                      border: isMatched
                        ? "2px solid var(--pos)"
                        : isSelected
                        ? matchError
                          ? "2px solid var(--neg)"
                          : "2px solid var(--brand)"
                        : "1.5px solid var(--line)",
                      background: isMatched ? "var(--pos-soft)" : isSelected ? "var(--brand-soft)" : "#111",
                      overflow: "hidden",
                      position: "relative",
                      cursor: isMatched ? "default" : "pointer",
                      opacity: isMatched ? 0.6 : 1,
                      boxShadow: "var(--shadow-tile)",
                      transition: "all 0.2s ease",
                    }}
                    aria-label={`Video ký hiệu cho ${w} ${isMatched ? "đã ghép" : isSelected ? "đang chọn" : ""}`}
                  >
                    {isMatched ? (
                      <span style={{ color: "var(--pos-txt)", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>✓ Đã khớp</span>
                    ) : (
                      <LoopVideo
                        word={w}
                        allowScrubber={false}
                        allowSpeedToggle={false}
                        style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {matchedWords.length === matchSet.length && matchSet.length > 0 && (
            <div className="card" style={{ background: "var(--grn-soft)", borderColor: "var(--grn)", padding: "16px 20px", alignItems: "center", textAlign: "center", gap: 12 }}>
              <span className="h3" style={{ color: "var(--grn-txt)", margin: 0 }}>🎉 Xuất sắc! Ghép đúng toàn bộ!</span>
              <span className="bm" style={{ color: "var(--txt)" }}>Bạn đã ghi nhớ rất tốt các cử chỉ tương ứng.</span>
              <Btn
                onClick={() => {
                  setMatchSet(shuffle(labels).slice(0, 4));
                  setMatchedWords([]);
                  setSelectedText(null);
                  setSelectedVideo(null);
                }}
                icon={RotateCcw}
              >
                Chơi ván tiếp theo
              </Btn>
            </div>
          )}
        </section>
      ) : quizMode === "choice" ? (
        <section className="col" style={{ gap: 14 }} aria-label="Nhìn ký hiệu đoán nghĩa">
          <div className="col col--tight">
            <span className="bm">
              {review ? "Ôn tập · " : "Đố vui · "}Câu {Math.min(idx + 1, deck.length)}/{deck.length}
            </span>
            <h1 className="h3" style={{ margin: 0 }}>Video này có nghĩa là gì?</h1>
          </div>

          <div style={{ borderRadius: 20, overflow: "hidden", background: "#000", position: "relative" }}>
            <LoopVideo
              word={target}
              slow
              allowSpeedToggle
              style={{ width: "100%", height: 260, objectFit: "cover", display: "block" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {choices.map((c) => {
              const isSelected = selectedChoice === c;
              const isTarget = c === target;
              let bg = "var(--surface)";
              let color = "var(--txt)";
              let border = "1.5px solid var(--line)";
              if (graded) {
                if (isTarget) {
                  bg = "var(--grn-soft)";
                  color = "var(--grn-txt)";
                  border = "2px solid var(--grn)";
                } else if (isSelected) {
                  bg = "var(--red-soft)";
                  color = "var(--red-txt)";
                  border = "2px solid var(--red)";
                }
              }
              return (
                <button
                  key={c}
                  type="button"
                  disabled={graded}
                  onClick={() => onPickChoice(c)}
                  style={{
                    background: bg,
                    color: color,
                    border: border,
                    borderRadius: 16,
                    padding: "16px 12px",
                    fontSize: 16,
                    fontWeight: 700,
                    minHeight: 56,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    cursor: graded ? "default" : "pointer",
                    boxShadow: "var(--shadow-tile)",
                    transition: "all 0.15s ease",
                  }}
                  aria-pressed={isSelected}
                >
                  {graded && isTarget && <CheckCircle2 size={18} color="var(--grn-txt)" aria-hidden />}
                  {graded && isSelected && !isTarget && <AlertCircle size={18} color="var(--red-txt)" aria-hidden />}
                  {c}
                </button>
              );
            })}
          </div>

          {graded && (
            <div className="card card--row" style={{ padding: "14px 16px", background: correct ? "var(--grn-soft)" : "var(--red-soft)", borderColor: correct ? "var(--grn)" : "var(--red)" }}>
              <span className="bb" style={{ color: correct ? "var(--grn-txt)" : "var(--red-txt)" }}>
                {correct ? "Chính xác! Bạn nhớ ký hiệu rất tốt." : `Chưa đúng. Ký hiệu này có nghĩa là “${target}”.`}
              </span>
            </div>
          )}
        </section>
      ) : (
        <section className="col" style={{ gap: 14 }} aria-label="Luyện ký với camera">
          <div className="col col--tight">
            <span className="bm">
              {review ? "Ôn tập · " : "Đố vui · "}Câu {Math.min(idx + 1, deck.length)}/{deck.length} · Hãy ký từ
            </span>
            <h1 className="d4">“{target || "…"}”</h1>
          </div>

          <SignCapture modelUrl={MODEL_URL} labelsUrl={LABELS_URL} features={WORD_FEATURES} onResult={onResult} locked={graded} manualLabel="Ký hiệu" errorNote="Bạn có thể bỏ qua câu này." />

          {pred && (
            <section className="card card--row" aria-live="polite" style={{ border: `2.5px solid ${correct ? "var(--grn)" : "var(--red)"}` }}>
              <Ring pct={Math.round(pred.confidence * 100)} color={correct ? "var(--grn)" : "var(--org)"} size={64} thick={8}>
                <span className="sm" style={{ color: "var(--txt)" }}>
                  {Math.round(pred.confidence * 100)}%
                </span>
              </Ring>
              <div className="col col--tight grow">
                <span className="h4">{correct ? "Đúng rồi!" : "Chưa đúng"}</span>
                {!correct && (
                  <span className="bm">
                    AI nhận ra: <b style={{ color: "var(--txt)" }}>{pred.label}</b>
                  </span>
                )}
              </div>
            </section>
          )}
        </section>
      )}

      {graded && (
        <Btn level={correct ? "positive" : "accent"} icon={ArrowRight} onClick={next}>
          {idx + 1 >= deck.length ? "Xem kết quả" : "Câu tiếp theo"}
          {adv.counting ? ` · ${adv.left}` : ""}
        </Btn>
      )}
      {!graded && (
        <Btn level="ghost" size="sm" icon={SkipForward} onClick={skip}>
          Bỏ qua câu này
        </Btn>
      )}
    </main>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={<main className="app">Đang tải…</main>}>
      <QuizInner />
    </Suspense>
  );
}
