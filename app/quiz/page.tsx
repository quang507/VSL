"use client";

import { asset } from "@/lib/base";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { X, ArrowRight, SkipForward, RotateCcw } from "lucide-react";
import { CONFIDENCE_THRESHOLD, MODEL_URL, LABELS_URL, WORD_FEATURES } from "@/lib/constants";
import SignCapture from "@/components/SignCapture";
import { useAutoAdvance } from "@/lib/useAutoAdvance";
import { useLabels } from "@/lib/useLabels";
import { recordAttempt, loadProgress, dueWords } from "@/lib/progress";
import { signal } from "@/lib/feedback";
import { loadProfile } from "@/lib/profile";
import type { Prediction } from "@/lib/classifier";
import Flash from "@/components/Flash";
import { Bar, Btn, IconBtn, Pill, Ring, Sticker } from "@/components/ui";

const QUIZ_LEN = 8;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function QuizInner() {
  const review = useSearchParams().get("mode") === "review";
  const router = useRouter();
  const { labels } = useLabels();

  const [deck, setDeck] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [pred, setPred] = useState<Prediction | null>(null);
  const [graded, setGraded] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "no" | null; tick: number }>({ kind: null, tick: 0 });

  const buildDeck = (ls: string[]) => (review ? dueWords(loadProgress(), ls) : shuffle(ls).slice(0, QUIZ_LEN));

  useEffect(() => {
    setDeck(buildDeck(labels));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels, review]);

  const target = deck[idx] ?? "";
  const finished = deck.length > 0 && idx >= deck.length;
  const score = results.filter(Boolean).length;

  const onResult = (result: Prediction | null) => {
    setPred(result);
    const ok = !!(result && result.label === target && result.confidence >= CONFIDENCE_THRESHOLD);
    if (result) {
      const p = recordAttempt(target, ok);
      const prof = loadProfile();
      signal(ok, { sound: p.soundOn, vibrate: prof.vibrate });
      if (prof.flash) setFlash((f) => ({ kind: ok ? "ok" : "no", tick: f.tick + 1 }));
    }
    setResults((r) => [...r, ok]);
    setGraded(true);
  };

  const next = () => {
    setIdx((i) => i + 1);
    setPred(null);
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
    setGraded(false);
  };

  const correct = !!pred && pred.label === target && pred.confidence >= CONFIDENCE_THRESHOLD;
  const auto = typeof window !== "undefined" ? loadProfile().autoSign : true;
  const adv = useAutoAdvance(auto && graded && correct && !finished, () => next());

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
          {review ? "Hoàn thành phiên ôn" : "Hoàn thành đố vui"}
        </Pill>
        <Ring pct={pct} color={pct >= 80 ? "var(--grn)" : "var(--org)"} size={176} thick={18}>
          <span className="d3">{pct}%</span>
          <span className="sm">
            {score}/{deck.length} câu đúng
          </span>
        </Ring>
        <h1 className="d4">{pct === 100 ? "Tuyệt đối!" : pct >= 80 ? "Giỏi lắm!" : pct >= 50 ? "Khá lắm!" : "Cố lên nhé!"}</h1>
        <p className="bm" style={{ margin: 0 }}>
          {pct >= 80 ? "Bạn nhớ ký hiệu rất tốt." : "Xem lại mẫu những từ sai rồi thử lại."}
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
          {review ? "Ôn lại" : "Chơi lại"}
        </Btn>
        <Btn level="tertiary" href="/luyen-tap">
          Về Luyện tập
        </Btn>
      </main>
    );
  }

  return (
    <main className="app" style={{ gap: 16 }}>
      <Flash kind={flash.kind} tick={flash.tick} />
      <div className="topbar" style={{ gap: 14 }}>
        <IconBtn icon={X} label="Đóng" onClick={() => router.push("/luyen-tap")} />
        <Bar pct={deck.length ? (idx / deck.length) * 100 : 0} h={12} />
        <Pill bg="var(--grn-soft)" fg="var(--grn-txt)">
          {score} đúng
        </Pill>
      </div>

      <div className="col col--tight">
        <span className="bm">
          {review ? "Ôn tập · " : "Đố vui · "}Câu {Math.min(idx + 1, deck.length)}/{deck.length} · Hãy ký từ
        </span>
        <h1 className="d4">“{target || "…"}”</h1>
      </div>

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

      {graded && (
        <Btn level={correct ? "positive" : "accent"} icon={ArrowRight} onClick={next}>
          {idx + 1 >= deck.length ? "Xem kết quả" : "Câu tiếp theo"}
          {adv.counting ? ` · ${adv.left}` : ""}
        </Btn>
      )}
      {!graded && (
        <Btn level="ghost" size="sm" icon={SkipForward} onClick={skip}>
          Không dùng được camera? Bỏ qua câu này
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
