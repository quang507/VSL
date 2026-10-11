// Hồ sơ người dùng lưu trên máy (không cần server).
// Tách khỏi progress.ts để không đụng tới dữ liệu tiến độ cũ.
import { useEffect, useState } from "react";

const KEY = "vsl-profile-v1";

export type Region = "hcm" | "hn" | "hp" | "all";

export interface Profile {
  name: string;
  region: Region;
  onboarded: boolean;
  vibrate: boolean; // rung khi đúng/sai
  flash: boolean; // nháy viền màn hình khi đúng/sai
  slowVideo: boolean; // phát video mẫu chậm mặc định
  autoSign: boolean; // tự chấm khi ký, không cần bấm nút (mặc định bật)
}

export const REGIONS: { id: Region; name: string; sub: string }[] = [
  { id: "hcm", name: "TP. Hồ Chí Minh", sub: "Phổ biến nhất" },
  { id: "hn", name: "Hà Nội", sub: "Ký hiệu miền Bắc" },
  { id: "hp", name: "Hải Phòng", sub: "Ký hiệu miền Bắc" },
  { id: "all", name: "Chưa rõ / Toàn quốc", sub: "Hiện ký hiệu phổ biến mọi vùng" },
];

export function emptyProfile(): Profile {
  return { name: "", region: "all", onboarded: false, vibrate: true, flash: true, slowVideo: false, autoSign: true };
}

export function loadProfile(): Profile {
  if (typeof window === "undefined") return emptyProfile();
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...emptyProfile(), ...JSON.parse(raw) } : emptyProfile();
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(patch: Partial<Profile>): Profile {
  const p = { ...loadProfile(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* localStorage bị chặn */
  }
  return p;
}

export function resetProfile() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* bỏ qua */
  }
}

// Đọc sau khi mount để tránh lệch hydration. `ready` = đã đọc xong.
export function useProfile() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setProfile(loadProfile());
    setReady(true);
  }, []);
  const update = (patch: Partial<Profile>) => setProfile(saveProfile(patch));
  return { profile, update, ready };
}
