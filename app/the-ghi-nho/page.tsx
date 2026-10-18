"use client";

import { asset } from "@/lib/base";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, RotateCw, XCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import { Bar, Btn, IconBtn, Pill, Sticker } from "@/components/ui";
import SampleMedia from "@/components/SampleMedia";
import { useLabels } from "@/lib/useLabels";
import { loadProgress, dueWords, recordAttempt, isLearned } from "@/lib/progress";
import { buildLessons } from "@/lib/lessons";

const LEN = 10;

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

type Rate = "forgot" | "fuzzy" | "good";

export default function Flashcards() {
  const router = useRouter();
  const { labels } = useLabels();
  const [deck, setDeck] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [rates, setRates] = useState<Rate[]>([]);

  const lessons = useMemo(() => buildLessons(labels), [labels]);

  useEffect(() => {
    if (!labels.length) return;
    const p = loadProgress();
    const due = dueWords(p, labels);
    const learned = labels.filter((w) => isLearned(p, w) && !due.includes(w));
    const fresh = labels.filter((w) => !isLearned(p, w));
    setDeck([...due, ...shuffle(learned), ...shuffle(fresh)].slice(0, LEN));
  }, [labels]);

  const word = deck[idx];
  const finished = deck.length > 0 && idx >= deck.length;
  const topic = word ? lessons.find((l) => l.words.includes(word))?.title : "";

  const rate = (r: Rate) => {
    // "Nhớ rõ" = đúng (lên hộp Leitner); "Quên/Nhớ mờ" = sai (ôn lại sớm)
    recordAttempt(word, r === "good");
    setRates((x) => [...x, r]);
    setFlipped(false);
    setIdx((i) => i + 1);
  };

  if (finished) {
    const good = rates.filter((r) => r === "good").length;
    const fuzzy = rates.filter((r) => r === "fuzzy").length;
    const forgot = rates.filter((r) => r === "forgot").length;
    return (
      <main className="app app--center" style={{ gap: 18 }}>
        <div className="grow" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="photo" src={asset("/img/celebrate.png")} alt="" style={{ width: 260, borderRadius: 32, border: "6px solid #fff", boxShadow: "var(--shadow-soft)", transform: "rotate(-3deg)" }} />
        <Pill bg="var(--grn-soft)" fg="var(--grn-txt)" icon={CheckCircle2}>
          Hoàn thành {deck.length} thẻ
        </Pill>
        <h1 className="d4">Tuyệt vời!</h1>
        <div className="card" style={{ flexDirection: "row", width: "100%", padding: "16px 8px", gap: 0 }}>
          {[
            [good, "Nhớ rõ", "var(--pos)"],
            [fuzzy, "Nhớ mờ", "var(--warn)"],
            [forgot, "Quên", "var(--neg)"],
          ].map(([n, l, c], i) => (
            <div key={l as string} className="col col--tight grow" style={{ alignItems: "center", borderLeft: i ? "1px solid var(--line)" : undefined }}>
              <span className="h2" style={{ color: c as string }}>
                {n as number}
              </span>
              <span className="sm">{l as string}</span>
            </div>
          ))}
        </div>
        <p className="bm" style={{ margin: 0 }}>
          Thẻ quên và nhớ mờ sẽ quay lại sớm hơn trong Ôn tập.
        </p>
        <div className="grow" />
        <Btn href="/luyen-tap">Về Luyện tập</Btn>
      </main>
    );
  }

  return (
    <main className="app" style={{ gap: 18 }}>
      <div className="topbar" style={{ gap: 14 }}>
        <IconBtn icon={X} label="Đóng" onClick={() => router.push("/luyen-tap")} />
        <Bar pct={deck.length ? (idx / deck.length) * 100 : 0} h={12} />
        <span className="bb muted">
          {Math.min(idx + 1, deck.length)}/{deck.length}
        </span>
      </div>

      {!word ? (
        <div className="skeleton" style={{ height: 420, borderRadius: 28 }} />
      ) : (
        <div className="flash-stack">
          <div className="flash-card">
            {!flipped ? (
              <div className="col" style={{ alignItems: "center", textAlign: "center", padding: "36px 8px", gap: 16 }}>
                <Pill bg="var(--brand-soft)" fg="var(--acc)">
                  {topic}
                </Pill>
                <span className="sm">Bạn còn nhớ ký hiệu của từ</span>
                <span className="d3">{word}</span>
                <Sticker src={asset("/img/hand_yellow.png")} size={120} rot={-8} />
                <span className="bm">Thử làm ký hiệu trong đầu (hoặc bằng tay), rồi lật thẻ để so.</span>
              </div>
            ) : (
              <>
                <SampleMedia word={word} aspect="1 / 1" />
                <div className="row row--between">
                  <span className="h3">{word}</span>
                  <Pill bg="var(--brand-soft)" fg="var(--acc)">
                    {topic}
                  </Pill>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!flipped ? (
        <Btn icon={RotateCw} onClick={() => setFlipped(true)} disabled={!word}>
          Lật thẻ
        </Btn>
      ) : (
        <>
          <h2 className="h4">Bạn nhớ ký hiệu này thế nào?</h2>
          <div className="row" style={{ gap: 10, alignItems: "stretch" }}>
            {(
              [
                ["forgot", "Quên", "Ôn lại ngay", "t-red", XCircle, "var(--neg)"],
                ["fuzzy", "Nhớ mờ", "Ôn sớm", "t-yel", AlertCircle, "var(--warn)"],
                ["good", "Nhớ rõ", "Ôn sau", "t-grn", CheckCircle2, "var(--pos)"],
              ] as const
            ).map(([k, t, s, tone, I, c]) => (
              <button key={k} type="button" className={`tile ${tone}`} onClick={() => rate(k)} style={{ flex: 1, alignItems: "center", textAlign: "center", padding: "14px 6px", boxShadow: "0 4px 0 var(--line)" }}>
                <span className="icon-circle" style={{ width: 40, height: 40, background: "var(--surface)", color: c }}>
                  <I size={22} aria-hidden />
                </span>
                <span className="bb">{t}</span>
                <span className="sm">{s}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
