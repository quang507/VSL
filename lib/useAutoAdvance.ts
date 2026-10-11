"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Đếm ngược rồi tự chuyển tiếp (dùng khi ký đúng ở chế độ tự chấm, để không phải chạm màn hình).
 * Người dùng luôn huỷ được bằng cancel().
 */
export function useAutoAdvance(active: boolean, onDone: () => void, seconds = 3) {
  const [left, setLeft] = useState(seconds);
  const [cancelled, setCancelled] = useState(false);
  const cb = useRef(onDone);
  cb.current = onDone;

  useEffect(() => {
    setCancelled(false);
    setLeft(seconds);
  }, [active, seconds]);

  useEffect(() => {
    if (!active || cancelled) return;
    if (left <= 0) {
      cb.current();
      return;
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [active, cancelled, left]);

  return { counting: active && !cancelled, left, cancel: () => setCancelled(true) };
}
