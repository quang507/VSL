"use client";

// "Câu giao tiếp": 60 câu, model + mẫu khung xương từ dữ liệu Look & Tell (Apache-2.0).
import { useEffect, useState } from "react";
import { asset } from "./base";

export const PHRASE_MODEL = asset("/models/phrases/model.json");
export const PHRASE_LABELS = asset("/models/phrases/labels.json");
export const PHRASE_DEMO = asset("/models/phrases/demo.json");

/** Mỗi frame: 84 số = 2 tay × 21 điểm × (x, y), toạ độ ảnh 0..1; tay vắng = toàn 0 */
export type DemoFrames = number[][];

/** Câu chưa xác định được nghĩa (tên gốc không dấu "ban trong cau co the" có nhiều cách đọc):
 *  vẫn là 1 lớp trong model, nhưng không đưa vào danh sách học và không hiện khi dịch. */
export const UNCLEAR_PHRASES = new Set(["Bạn trông cậu có thể…"]);

let labelsP: Promise<string[]> | null = null;
let demoP: Promise<Record<string, DemoFrames>> | null = null;

export function usePhrases() {
  const [labels, setLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    labelsP ??= fetch(PHRASE_LABELS)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => ((labelsP = null), []));
    labelsP.then((l) => {
      setLabels(l);
      setLoading(false);
    });
  }, []);
  return { labels, loading };
}

export function usePhraseDemo(phrase: string) {
  const [frames, setFrames] = useState<DemoFrames | null>(null);
  useEffect(() => {
    demoP ??= fetch(PHRASE_DEMO)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ((demoP = null), {}));
    demoP.then((d) => setFrames(d[phrase] ?? null));
  }, [phrase]);
  return frames;
}

export function phraseUrl(i: number) {
  return `/cau/luyen?i=${i}`;
}
