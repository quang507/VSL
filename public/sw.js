// Service worker cho bản Web/PWA: cho phép dùng offline mà KHÔNG phục vụ nội dung cũ sai cách.
// Chiến lược:
//  - HTML (điều hướng) + dữ liệu/model (labels.json, qipedc.json, /models/): network-first → có mạng
//    thì luôn mới, mất mạng mới lấy bản đã cache.
//  - Asset tĩnh bất biến (_next, video mẫu, mediapipe, icon, font, ảnh): cache-first (stale-while-revalidate).
//  - Bản đóng gói Capacitor (chạy ở localhost) KHÔNG đụng tới — để WebView tự phục vụ asset trong app.
// Đổi CACHE khi cần dọn cache cũ của người dùng.
const CACHE = "vslv-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// App đóng gói native → bỏ qua hoàn toàn, tránh can thiệp việc phục vụ asset trong gói.
// Capacitor chạy ở localhost (scheme https trên Android, capacitor:// trên iOS) hoặc file:// → chặn cả hai lớp.
const isNative =
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1" ||
  /^(capacitor|ionic|file)/.test(self.location.protocol);

const STATIC_RE = /\/_next\/|\/samples\/|\/mediapipe\/|\/icons\/|\/img\/|\/fonts\/|\.(?:js|css|woff2?|png|jpg|jpeg|webp|svg|mp4|task|tflite|wasm)$/i;
const FRESH_RE = /labels\.json|qipedc\.json|\/models\//i;

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) {
    // cập nhật ngầm cho lần sau
    fetch(req).then((res) => res.ok && caches.open(CACHE).then((c) => c.put(req, res.clone()))).catch(() => {});
    return cached;
  }
  const res = await fetch(req);
  if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
    return res;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (req.mode === "navigate") {
      const shell = await caches.match("./");
      if (shell) return shell;
    }
    throw err;
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (isNative || req.method !== "GET") return; // để trình duyệt/WebView xử lý như thường
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // không cache cross-origin (vd. video từ điển QIPEDC)

  if (req.mode === "navigate" || FRESH_RE.test(url.pathname)) {
    e.respondWith(networkFirst(req));
  } else if (STATIC_RE.test(url.pathname)) {
    e.respondWith(cacheFirst(req));
  }
});
