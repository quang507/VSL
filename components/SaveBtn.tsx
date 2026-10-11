"use client";

import { Heart } from "lucide-react";
import { useSaved } from "@/lib/saved";

/** Nút tim lưu từ (Figma "05 Word Detail": vòng tròn xanh, tim trắng khi đã lưu). */
export default function SaveBtn({ word }: { word: string }) {
  const { isSaved, toggle } = useSaved();
  const on = isSaved(word);
  return (
    <button
      type="button"
      className="icon-btn"
      aria-pressed={on}
      aria-label={on ? `Bỏ lưu “${word}”` : `Lưu “${word}”`}
      onClick={() => toggle(word)}
      style={on ? { background: "var(--brand)", color: "#fff" } : undefined}
    >
      <Heart size={22} fill={on ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
