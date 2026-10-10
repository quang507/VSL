"use client";

import { useEffect } from "react";
import { asset } from "@/lib/base";

// Đăng ký service worker để app có thể "cài" lên màn hình chính.
export default function PWARegister() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register(asset("/sw.js")).catch(() => {
        /* bỏ qua nếu trình duyệt không hỗ trợ */
      });
    }
  }, []);
  return null;
}
