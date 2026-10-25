// Sao lưu / khôi phục dữ liệu học để chống mất mát (iOS Safari xóa storage sau 7 ngày không dùng,
// Android dọn WebView storage khi đầy máy). Gom tất cả khóa "vsl-*" trong localStorage thành 1 file JSON.

const PREFIX = "vsl-";

export interface Backup {
  app: "VSLV";
  v: 1;
  exportedAt: string;
  data: Record<string, string>;
}

/** Yêu cầu trình duyệt giữ bền storage (hạn chế bị dọn). Gọi 1 lần lúc mở app; an toàn nếu không hỗ trợ. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Gom mọi khóa vsl-* thành đối tượng sao lưu. */
export function buildBackup(): Backup {
  const data: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) {
        const v = localStorage.getItem(k);
        if (v !== null) data[k] = v;
      }
    }
  } catch {
    /* localStorage bị chặn */
  }
  return { app: "VSLV", v: 1, exportedAt: new Date().toISOString(), data };
}

/** Tải file sao lưu .json về máy. */
export function downloadBackup() {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vslv-sao-luu-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Khôi phục từ nội dung file JSON. Trả về số khóa đã ghi, hoặc ném lỗi nếu file sai định dạng. */
export function restoreBackup(json: string): number {
  const parsed = JSON.parse(json) as Partial<Backup>;
  if (parsed?.app !== "VSLV" || !parsed.data || typeof parsed.data !== "object") {
    throw new Error("File sao lưu không hợp lệ");
  }
  let n = 0;
  for (const [k, v] of Object.entries(parsed.data)) {
    if (k.startsWith(PREFIX) && typeof v === "string") {
      try {
        localStorage.setItem(k, v);
        n++;
      } catch {
        /* bỏ qua khóa ghi lỗi */
      }
    }
  }
  return n;
}
