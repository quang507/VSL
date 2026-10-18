"use client";

import { CameraOff, RotateCcw } from "lucide-react";

/**
 * Báo lỗi camera kèm cách khắc phục và nút thử lại (Nielsen #9: giúp người dùng tự gỡ lỗi).
 * Trình duyệt chỉ hỏi quyền lại sau khi tải lại trang.
 */
export default function CameraError({ note }: { note?: string }) {
  return (
    <div className="tile t-red" role="alert" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
        <CameraOff size={22} color="var(--neg)" aria-hidden style={{ flex: "none", marginTop: 2 }} />
        <span className="bm" style={{ color: "var(--txt)" }}>
          Chưa mở được camera. Hãy cho phép quyền camera cho trang này trong cài đặt trình duyệt hoặc cài đặt máy, rồi bấm Thử lại.{note ? ` ${note}` : ""}
        </span>
      </div>
      <button type="button" className="btn btn--tertiary btn--md" onClick={() => window.location.reload()} style={{ alignSelf: "flex-start" }}>
        <RotateCcw size={20} aria-hidden /> Thử lại
      </button>
    </div>
  );
}
