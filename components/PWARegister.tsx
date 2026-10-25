"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { asset } from "@/lib/base";
import { requestPersistentStorage } from "@/lib/backup";

// Đăng ký service worker + Xử lý Deep Linking cho App/PWA/Capacitor
export default function PWARegister() {
  useEffect(() => {
    // App đóng gói Capacitor (iOS/Android) phục vụ asset từ trong gói → KHÔNG đăng ký service worker
    // (tránh mọi can thiệp của SW vào việc nạp asset native). SW chỉ dành cho bản Web/PWA.
    if (!Capacitor.isNativePlatform() && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register(asset("/sw.js")).catch(() => {
        /* bỏ qua nếu trình duyệt không hỗ trợ */
      });
    }

    // Xin giữ bền storage để tiến độ/streak/điểm Checkpoint không bị dọn khi máy đầy hoặc theo ITP iOS
    void requestPersistentStorage();

    // Xử lý deep link khi mở app từ scheme vslv:// hoặc link ngoài
    const handleUrl = (urlString: string) => {
      try {
        if (!urlString) return;
        // Hỗ trợ scheme vslv://path?query hoặc https://domain/path?query
        let targetPath = "";
        if (urlString.startsWith("vslv://")) {
          const stripped = urlString.replace(/^vslv:\/\//, "");
          targetPath = stripped.startsWith("/") ? stripped : `/${stripped}`;
        } else if (urlString.startsWith("http://") || urlString.startsWith("https://")) {
          const u = new URL(urlString);
          targetPath = `${u.pathname}${u.search}${u.hash}`;
        }
        if (targetPath && targetPath !== window.location.pathname + window.location.search) {
          window.location.assign(targetPath);
        }
      } catch (err) {
        console.warn("Deep link parse failed", err);
      }
    };

    // Lắng nghe sự kiện từ Capacitor native appUrlOpen
    const win = window as unknown as {
      Capacitor?: {
        Plugins?: {
          App?: {
            addListener?: (
              eventName: string,
              callback: (data: { url: string }) => void
            ) => Promise<{ remove: () => void }>;
          };
        };
      };
    };

    let removeListener: (() => void) | undefined;
    win.Capacitor?.Plugins?.App?.addListener?.("appUrlOpen", (data) => {
      handleUrl(data.url);
    }).then((sub) => {
      removeListener = () => sub.remove();
    }).catch(() => {});

    // Lắng nghe custom event 'appUrlOpen' nếu được bắn từ native bridge
    const onCustomUrl = (e: Event) => {
      const detail = (e as CustomEvent<{ url: string }>).detail;
      if (detail?.url) handleUrl(detail.url);
    };
    window.addEventListener("appUrlOpen", onCustomUrl);

    return () => {
      removeListener?.();
      window.removeEventListener("appUrlOpen", onCustomUrl);
    };
  }, []);
  return null;
}
