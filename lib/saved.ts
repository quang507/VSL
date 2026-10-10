"use client";

// Từ đã lưu (Figma: nút tim ở "Chi tiết từ", mục "Đã lưu gần đây", ô "Đã lưu" ở Hồ sơ).
// Lưu trên máy (localStorage), mới nhất đứng đầu.
import { useCallback, useEffect, useState } from "react";

const KEY = "vsl-saved-v1";
const EVT = "vsl-saved-change";

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* chế độ riêng tư: bỏ qua */
  }
  window.dispatchEvent(new Event(EVT));
}

export function useSaved() {
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setSaved(read());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const toggle = useCallback((w: string) => {
    const cur = read();
    write(cur.includes(w) ? cur.filter((x) => x !== w) : [w, ...cur]);
  }, []);
  return { saved, isSaved: (w: string) => saved.includes(w), toggle };
}
