"use client";

import { useEffect, useState } from "react";

/** Có mạng hay không. Phần học 100 từ chạy offline; chỉ video từ điển Bộ GD&ĐT cần mạng. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return online;
}
