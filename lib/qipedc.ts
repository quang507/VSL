"use client";

import { useEffect, useState } from "react";
import type { Region } from "@/lib/profile";

export type Variants = Partial<Record<"B" | "T" | "N" | "_", string>>; // mã video theo miền

/** Một nghĩa của từ; mỗi nghĩa có video riêng (vd. "tác động" danh từ / động từ). */
export interface QSense {
  d: string; // nghĩa
  t: string; // từ loại
  v: Variants;
}

/** Một mục từ điển QIPEDC (Bộ GD&ĐT). Xem training/qipedc/build_dict.py. */
export interface QEntry {
  w: string; // từ
  k: 0 | 1 | 2; // 0 từ, 1 số, 2 chữ cái
  s: QSense[];
}

export const REGION_ORDER = ["B", "T", "N", "_"] as const;
export function variantsOf(sense: QSense): string[] {
  return REGION_ORDER.filter((r) => sense.v[r]);
}

export const QIPEDC_SOURCE = "Từ điển ngôn ngữ ký hiệu, Bộ GD&ĐT (qipedc.moet.gov.vn)";
export const VARIANT_NAME: Record<string, string> = { B: "Miền Bắc", T: "Miền Trung", N: "Miền Nam", _: "Toàn quốc" };

export function videoUrl(id: string) {
  return `https://qipedc.moet.gov.vn/videos/${id}.mp4`;
}

/** Thứ tự ưu tiên biến thể theo vùng người dùng chọn lúc đầu. */
export function preferredVariant(sense: QSense, region: Region): string {
  const order = region === "hn" || region === "hp" ? ["B", "_", "T", "N"] : region === "hcm" ? ["N", "_", "T", "B"] : ["_", "N", "B", "T"];
  return order.find((r) => sense.v[r as keyof Variants]) ?? Object.keys(sense.v)[0];
}

// Tìm không dấu
export const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();

let cached: Promise<QEntry[]> | null = null;

function load(): Promise<QEntry[]> {
  cached ??= fetch("/data/qipedc.json")
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => {
      cached = null;
      return [];
    });
  return cached;
}

export function useQipedc() {
  const [entries, setEntries] = useState<QEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let on = true;
    load().then((d) => {
      if (on) {
        setEntries(d);
        setLoading(false);
      }
    });
    return () => {
      on = false;
    };
  }, []);
  return { entries, loading };
}

export function wordUrl(w: string, sense = 0) {
  return `/tu-dien/tu?w=${encodeURIComponent(w)}${sense ? `&s=${sense}` : ""}`;
}
