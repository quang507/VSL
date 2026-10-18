// Tiền tố đường dẫn khi app chạy ở thư mục con (GitHub Pages: /VSL).
// Bản đóng gói Capacitor và máy chủ riêng để trống.
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Đường dẫn tới file tĩnh trong public/ (ảnh, video, model, dữ liệu). */
export const asset = (path: string) => `${BASE}${path}`;
