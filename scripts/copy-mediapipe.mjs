// Chép bộ WASM của MediaPipe từ node_modules vào public/mediapipe/wasm trước khi build.
// Lý do: app phải chạy không cần mạng (App Store 4.2) và WASM phải ĐÚNG phiên bản với
// thư viện JS đã cài (trước đây tải 0.10.14 từ CDN trong khi JS là 0.10.35).
// Chạy tự động qua "prebuild" và "predev".
import { copyFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dst = join(root, "public", "mediapipe", "wasm");
// Bản SIMD cho máy mới, bản không SIMD cho iOS 15–16.3 và Android cũ
const files = ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"];

mkdirSync(dst, { recursive: true });
let bytes = 0;
for (const f of files) {
  copyFileSync(join(src, f), join(dst, f));
  bytes += statSync(join(dst, f)).size;
}
const model = join(root, "public", "mediapipe", "hand_landmarker.task");
if (!existsSync(model)) {
  console.error("Thiếu public/mediapipe/hand_landmarker.task (model bàn tay, ~7,8 MB).");
  process.exit(1);
}
console.log(`MediaPipe: đã chép ${files.length} file WASM (${(bytes / 1e6).toFixed(1)} MB) + model ${(statSync(model).size / 1e6).toFixed(1)} MB`);
