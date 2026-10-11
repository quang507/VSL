"use client";

/** Viền màn hình nháy xanh (đúng) / đỏ (sai) — tín hiệu thị giác thay cho âm thanh. */
export default function Flash({ kind, tick }: { kind: "ok" | "no" | null; tick: number }) {
  if (!kind) return null;
  return <div key={tick} className={`flash flash--${kind}`} aria-hidden />;
}
