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

export interface PhraseMeta {
  category: "family" | "health" | "questions" | "daily";
  categoryLabel: string;
  expression: {
    badge: string; // ví dụ: "Nhướng mày (Có/Không)" hoặc "Cau mày (Hỏi Wh-)" hoặc "Mỉm cười"
    tip: string;   // giải thích cách phối hợp mặt
    color: string; // text color đạt WCAG AA trên nền sáng
    badgeBg: string; // màu nền badge
    badgeFg: string; // màu chữ badge
  };
  dialogue: {
    partnerPrompt: string; // Lời dẫn của người đối diện trước khi bạn ký
    partnerReply: string;  // Phản hồi của người đối diện sau khi bạn ký đúng
  };
}

export function getPhraseMeta(p: string): PhraseMeta {
  if (p.includes("không?") || p.includes("phải không?")) {
    return {
      category: "questions",
      categoryLabel: "Hỏi đáp",
      expression: {
        badge: "Nhướng mày (Có/Không)",
        tip: "Nhướng hai hàng mày và hơi rướn đầu về phía trước để biểu thị câu hỏi Có/Không.",
        color: "var(--acc)",
        badgeBg: "var(--acc)",
        badgeFg: "#ffffff",
      },
      dialogue: {
        partnerPrompt: "Người thân đang lắng nghe câu hỏi của bạn:",
        partnerReply: "Gật đầu: 'Có, tôi hiểu rồi!'",
      },
    };
  }
  if (p.includes("gì?") || p.includes("đâu?") || p.includes("mấy?") || p.includes("bao nhiêu") || p.includes("là gì?")) {
    return {
      category: "questions",
      categoryLabel: "Hỏi đáp",
      expression: {
        badge: "Cau mày (Từ để hỏi)",
        tip: "Hơi cau mày nhẹ và nghiêng đầu để nhấn mạnh từ để hỏi (Gì / Đâu / Bao nhiêu).",
        color: "var(--org-txt)",
        badgeBg: "var(--org-txt)",
        badgeFg: "#ffffff",
      },
      dialogue: {
        partnerPrompt: "Hãy hỏi người thân bằng câu ký hiệu này:",
        partnerReply: "Mỉm cười gật đầu và nhiệt tình trả lời câu hỏi của bạn.",
      },
    };
  }
  if (p.includes("không") || p.includes("chưa") || p.includes("kém")) {
    return {
      category: "daily",
      categoryLabel: "Thường nhật",
      expression: {
        badge: "Lắc đầu (Phủ định)",
        tip: "Lắc đầu nhẹ, dứt khoát đồng thời với động tác tay để nhấn mạnh ý phủ định.",
        color: "var(--red-txt)",
        badgeBg: "var(--red-txt)",
        badgeFg: "#ffffff",
      },
      dialogue: {
        partnerPrompt: "Tình huống: Bạn cần giải thích hoặc làm rõ ý:",
        partnerReply: "Người đối diện gật đầu thấu hiểu chia sẻ của bạn.",
      },
    };
  }
  if (p.includes("mẹ") || p.includes("bố") || p.includes("yêu") || p.includes("Cảm ơn") || p.includes("Chúc mừng") || p.includes("vui") || p.includes("nhớ")) {
    return {
      category: "family",
      categoryLabel: "Gia đình & Cảm xúc",
      expression: {
        badge: "Mỉm cười & Ấm áp",
        tip: "Nét mặt tươi tắn, ánh mắt giao tiếp ấm áp để truyền tải trọn vẹn tình cảm.",
        color: "var(--pnk-txt)",
        badgeBg: "var(--pnk-txt)",
        badgeFg: "#ffffff",
      },
      dialogue: {
        partnerPrompt: "Hãy gửi gắm lời yêu thương/chia sẻ đến người thân:",
        partnerReply: "Người thân mỉm cười xúc động và gật đầu cảm ơn bạn!",
      },
    };
  }
  if (p.includes("đau") || p.includes("bệnh") || p.includes("vệ sinh") || p.includes("bác sĩ") || p.includes("thuốc") || p.includes("Cấp cứu") || p.includes("chóng mặt") || p.includes("đói")) {
    return {
      category: "health",
      categoryLabel: "Sức khỏe & Nhu cầu",
      expression: {
        badge: "Biểu cảm cấp thiết",
        tip: "Nét mặt biểu cảm rõ mức độ đau hoặc sự cần kíp để người nhà nắm bắt hỗ trợ ngay.",
        color: "var(--yel-txt)",
        badgeBg: "var(--yel-txt)",
        badgeFg: "#ffffff",
      },
      dialogue: {
        partnerPrompt: "Tình huống cần thiết: Bạn cần người nhà hỗ trợ:",
        partnerReply: "Người thân hiểu ngay và lập tức giúp đỡ bạn!",
      },
    };
  }
  return {
    category: "daily",
    categoryLabel: "Thường nhật",
    expression: {
      badge: "Tự nhiên & Giao tiếp mắt",
      tip: "Ánh mắt nhìn thẳng vào người đối diện, biểu cảm gương mặt tự nhiên và tự tin.",
      color: "var(--acc)",
      badgeBg: "var(--acc)",
      badgeFg: "#ffffff",
    },
    dialogue: {
      partnerPrompt: "Thực hành giao tiếp thường nhật cùng gia đình:",
      partnerReply: "Giao tiếp thành công, mọi người đều hiểu rõ ý bạn!",
    },
  };
}
