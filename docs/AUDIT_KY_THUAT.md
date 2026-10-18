# VSLV — Brutal Technical Audit

> Phạm vi: nhánh `redesign-vslv` @ `b4947df`, ngày 18/10/2026. Mọi kết luận dưới đây dựa trên mã nguồn, cấu hình deploy, kích thước asset đo trực tiếp trong `public/` và các báo cáo đánh giá model trong `training/`. Chỗ nào là suy luận (không đo được trong repo) đều ghi rõ.

---

## 0. Đính chính tiền đề — hệ thống thực tế KHÁC với mô tả

Đề bài mô tả một hệ thống nặng hơn và "đầy đủ" hơn thứ đang có trong repo. Audit dựa trên thứ đang có, nên phải nói thẳng trước:

| Đề bài nói | Thực tế trong code | Hệ quả cho audit |
|---|---|---|
| MediaPipe **Holistic**, **543 keypoints** (face + hands + pose) | Chỉ `HandLandmarker` (2 tay × 21 điểm) + `FaceDetector` BlazeFace (chỉ lấy **1 khung chữ nhật** mặt) — `lib/handLandmarker.ts:72-91`, `lib/constants.ts:2-15`. Đặc trưng mỗi frame: 126 hoặc 136 số. | Không có pose (khuỷu, vai), không có biểu cảm mặt. Đây là giới hạn ML lớn nhất (mục 5). |
| Tải **22,3 MB WASM** + model 8 MB | Có 2 bản WASM (SIMD 10,64 MB, no‑SIMD 10,00 MB) nhưng mỗi máy chỉ tải **một**. Cold start camera thực tế: WASM 10,6 + loader 0,3 + `hand_landmarker.task` 7,46 + BlazeFace 0,22 + classifier 1,39 + chunk TF.js 1,56 MB (chưa nén) ≈ **~21 MB thô, ~12–20 MB qua mạng** tùy host có nén WASM hay không. | Con số nhỏ hơn đề bài, nhưng vì **không có cache nào** (mục 1.4) nên vẫn là vấn đề. |
| **>1.000 video MP4** bài giảng | 100 video mẫu tự host (`public/samples`, 13,6 MB, trung bình 136 KB, **đều đã faststart** ✓) + **4.362 video từ điển hotlink thẳng từ `qipedc.moet.gov.vn`** (`lib/qipedc.ts:31-33`). | Rủi ro hạ tầng số 1 không phải băng thông của bạn, mà là **phụ thuộc vào server của Bộ GD&ĐT** (mục 1.3). |
| IndexedDB lưu tiến độ, **video cache** | **Không có IndexedDB, không có video cache.** Chỉ có `localStorage` (3 khoá JSON + 1 khoá tab). Service Worker là **no-op** (`public/sw.js:5-7`). | Mục 4 viết lại theo đúng thực tế: rủi ro là mất dữ liệu, không phải QuotaExceeded. |
| Từ điển "200 → 5.000 từ" | Từ điển tra cứu đã có **3.315 mục / 4.362 video**; model nhận diện chỉ biết **100 từ** (+ model câu riêng). | Khoảng cách 3% giữa "tra được" và "chấm được" là vấn đề sản phẩm thật (mục 5.3). |

---

## 1. Hạ tầng & phân phối

### 1.1 [CRITICAL] Hai nhánh cùng deploy đè lên một site production

**Hiện tượng & nguyên nhân gốc.** `.github/workflows/pages.yml:7` kích hoạt deploy cho `branches: [main, redesign-vslv]`, cùng `concurrency: group: pages`. Không có môi trường preview riêng → **lần push cuối cùng, từ nhánh nào cũng vậy, chính là production**. Nhánh bạn đang làm việc *chính là* `redesign-vslv`.

**Worst-case.** Một commit dở dang trên nhánh redesign (vd. model mới đổi `WORD_FEATURES` mà `labels.json` chưa khớp → `predictTopK` ném lỗi "Model cần N số/frame", `lib/classifier.ts:52`) lên thẳng site người dùng thật đang mở. Người Điếc đang học thấy mọi lần ký đều "Chưa tải được bộ chấm". Không có rollback ngoài việc push tiếp.

**Giải pháp.**
```yaml
# .github/workflows/pages.yml
on:
  push:
    branches: [main]          # chỉ main lên production
  workflow_dispatch:
```
Preview cho nhánh tính năng: dùng Cloudflare Pages / Vercel preview deployments (mỗi nhánh 1 URL riêng), không bao giờ chung URL với production.

### 1.2 [CRITICAL khi scale] GitHub Pages không phải hạ tầng cho sản phẩm này

**Hiện tượng & nguyên nhân gốc.** Production chạy trên GitHub Pages. Giới hạn đã công bố: **băng thông mềm ~100 GB/tháng**, site ≤ 1 GB, **không cho đặt header tuỳ ý** (không `Cache-Control`, không CSP, không `Permissions-Policy`), và điều khoản không nhằm phục vụ ứng dụng thương mại/SaaS. Cache mặc định ngắn (~10 phút), không thể `immutable`.

Toán băng thông (suy luận từ kích thước đo được): 1 người dùng lần đầu mở camera ≈ 12–20 MB. 100 GB ÷ ~15 MB ≈ **~6.500 lượt cold start/tháng** — tức vài nghìn người dùng thật là chạm trần, chưa tính người dùng cũ phải tải lại (mục 1.4).

**Worst-case.** Một đợt lan truyền (trường khiếm thính, hội người Điếc chia sẻ link) → GitHub gửi cảnh báo / bóp băng thông giữa tháng → model 10 MB tải dở, camera "Đang tải bộ chấm…" vĩnh viễn.

**Giải pháp kiến trúc.**
- Chuyển sang **Cloudflare Pages** (static, băng thông không tính phí, giới hạn 25 MiB/file — WASM 10,6 MB lọt) + **Cloudflare R2** cho video (không tính phí egress). Vercel Hobby cũng giới hạn ~100 GB và cấm dùng thương mại → không giải quyết gốc.
- **Đặt version vào đường dẫn** để cache vĩnh viễn được. Sửa `scripts/copy-mediapipe.mjs:11` chép vào `public/mediapipe/<phiên bản tasks-vision>/wasm`, model vào `public/models/vsl/<hash nội dung>/`.
- File `public/_headers` (Cloudflare Pages):
```
/mediapipe/*
  Cache-Control: public, max-age=31536000, immutable
/models/*
  Cache-Control: public, max-age=31536000, immutable
/samples/*
  Cache-Control: public, max-age=2592000
/*
  Permissions-Policy: camera=(self), microphone=(), geolocation=()
  Referrer-Policy: strict-origin
  X-Content-Type-Options: nosniff
```

### 1.3 [CRITICAL] Từ điển sống nhờ hotlink 4.362 video của server Bộ GD&ĐT

**Hiện tượng & nguyên nhân gốc.** `videoUrl()` trả `https://qipedc.moet.gov.vn/videos/${id}.mp4` (`lib/qipedc.ts:31-33`), dùng ở `app/tu-dien/page.tsx:699`, `app/tu-dien/tu/page.tsx:156`, `app/tu-dien/luyen/page.tsx:53`. Toàn bộ tính năng từ điển phụ thuộc một server bạn không kiểm soát, không có SLA, không có thoả thuận (trong repo không có giấy phép/thoả thuận nào). `app/tu-dien/page.tsx` và `app/tu-dien/luyen/page.tsx` **không có `onError`** cho video.

Mâu thuẫn nội bộ: `scripts/copy-mediapipe.mjs:2` lý luận "app phải chạy không cần mạng (App Store 4.2)", nhưng từ điển trong bản Capacitor lại cần mạng tới server bên thứ ba.

**Worst-case.** (a) Bộ bật chống hotlink theo `Referer`/`Origin`, hoặc đổi cấu trúc URL, hoặc server bảo trì → 100% video từ điển thành ô đen, không thông báo lỗi. (b) Lưu lượng của bạn đẩy lên server nhà nước → bị chặn IP/CDN. (c) Rủi ro pháp lý/review App Store: phân phối nội dung bên thứ ba không có giấy phép trong app thương mại.

**Giải pháp.**
1. **Pháp lý trước kỹ thuật:** xin văn bản cho phép sử dụng/phân phối lại từ QIPEDC. Không có thì không nên mirror.
2. Có giấy phép → mirror lên R2, **transcode chuẩn hoá**: H.264 baseline/main, 360p, `-movflags +faststart`, GOP ngắn (keyframe mỗi 0,5 s) để tua từng frame nhanh:
   ```bash
   ffmpeg -i in.mp4 -an -vf scale=-2:360 -c:v libx264 -profile:v main -crf 28 -g 12 -keyint_min 12 -movflags +faststart out.mp4
   ```
3. Ngay bây giờ: thêm `onError` + trạng thái "Video từ điển tạm thời không tải được (nguồn: Bộ GD&ĐT)" ở mọi `<video src={videoUrl(...)}>`, và `preload="none"` cho danh sách.

### 1.4 [HIGH] Service Worker không cache gì → mạng yếu là chết

**Hiện tượng & nguyên nhân gốc.** `public/sw.js:5-7` có fetch handler rỗng, chú thích nói cố ý để tránh phục vụ `labels.json`/model cũ. Nguyên nhân gốc thật là **URL không có version** (mục 1.2), nên cache-first sẽ phục vụ model cũ → nhóm đã chọn "không cache" thay vì sửa URL. Hệ quả: offline PWA không hoạt động; mọi lần quay lại phụ thuộc HTTP cache của trình duyệt, vốn bị iOS/Android đuổi rất sớm với file lớn.

**Worst-case (3G/4G yếu, ~1–2 Mbps hiệu dụng).** 12–20 MB ≈ **1–3 phút** trước khi chấm được lần đầu. Mạng rớt ở 80% file WASM 10,6 MB → `FilesetResolver` lỗi, tải lại **từ đầu** (không resume). `getVision()` cache promise lỗi (`lib/handLandmarker.ts:17`) → **mọi lần thử sau trong phiên đều lỗi luôn** cho tới khi reload trang, vì `visionP` không bị xoá khi reject (khác với `classifier.ts:42` có xoá).

**Giải pháp.**
```ts
// lib/handLandmarker.ts — cho phép thử lại khi tải WASM lỗi
const getVision = () =>
  (visionP ??= FilesetResolver.forVisionTasks(asset("/mediapipe/wasm")).catch((e) => {
    visionP = null;
    throw e;
  }));
```
```js
// public/sw.js — cache-first CHỈ cho asset ML có version trong URL; video không đụng tới
const ML_CACHE = "ml-v1"; // sinh tự động lúc build từ hash các file ML
self.addEventListener("activate", (e) =>
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("ml-") && k !== ML_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
);
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;                 // không cache qipedc
  if (e.request.headers.has("range") || e.request.destination === "video") return; // để trình duyệt tự xử lý Range/206
  if (/\/(mediapipe|models)\//.test(url.pathname)) {
    e.respondWith(
      caches.open(ML_CACHE).then(async (c) => (await c.match(e.request)) ?? fetch(e.request).then((r) => (r.ok && r.status === 200 && c.put(e.request, r.clone()), r)))
    );
  }
});
```
Cache theo lượt truy cập (runtime), **không** `addAll` 20 MB lúc install — người chỉ xem từ điển không phải trả 20 MB. Không bao giờ cache response `206` (video tua).

Thêm UI tiến độ tải model (đọc `Content-Length` + stream) cho lần đầu, thay vì "Đang tải bộ chấm…" không có con số.

### 1.5 [LOW] "Tua từng frame" không phải từng frame

`LoopVideo.tsx:265,321` bước cứng ±0,06 s; slider `step={0.03}` (`:277`). Ở 25–30 fps, 0,06 s ≈ 1,5–2 frame, và seek tới frame không phải keyframe trên Safari chậm/nhảy. Sửa: lấy fps thật từ metadata (`requestVideoFrameCallback` → `mediaTime`), bước `1/fps`; kết hợp GOP ngắn ở 1.3.

---

## 2. Hiệu năng phần cứng & vòng đời bộ nhớ

### 2.1 [HIGH] Toàn bộ pipeline chạy trên main thread, không giới hạn tần số, không quản lý nhiệt

**Hiện tượng & nguyên nhân gốc.** `useSignPractice.ts:122-180` và `useContinuousSign.ts:93-139`: trong `requestAnimationFrame`, **đồng bộ** gọi `detectForVideo` tay → `detectForVideo` mặt → vẽ canvas → `setState` React, cho **mọi** frame camera mới. Trong bước "Tập & chấm", `app/practice/page.tsx:378` còn chạy thêm `LoopVideo` ở góc (giải mã video thứ hai). Không có trần FPS, không đo chi phí mỗi frame, không giảm tải khi máy nóng. Bộ dò mặt còn chạy mỗi frame dù khung mặt chỉ dùng trung vị trên 10 giây (`faceTracker.ts:14`).

**Worst-case (Android 3–4 GB RAM, chip tầm thấp).** Detect tay 40–70 ms/frame → main thread bận >70% → cuộn/nhấn nút giật, `setTimeout` đếm ngược trễ. Sau 5–10 phút SoC đạt ngưỡng nhiệt, CPU/GPU bị hạ xung → FPS dò tay tụt về 5–8 → chất lượng nhận diện giảm (mục 3.2) đúng lúc người dùng đang luyện nhiều nhất. Pin tụt nhanh. *(Con số ms là ước lượng điển hình cho dòng máy này, chưa đo trên thiết bị thật — cần đo, xem P1.)*

**Giải pháp.**
1. Giới hạn và tự điều chỉnh tần số (dùng `requestVideoFrameCallback`, chỉ gọi khi có frame mới thật):
```ts
let last = 0, cost = 0, faceEvery = 0;
const tick: VideoFrameRequestCallback = (now) => {
  const budget = Math.max(1000 / 15, cost * 1.5);   // tối đa 15 Hz, tự giãn khi máy chậm
  if (now - last >= budget) {
    last = now;
    const t0 = performance.now();
    const hands = detectHands(hl, v, now);
    if (fd && ++faceEvery % 5 === 0) {/* dò mặt 3 Hz là đủ cho trung vị 10 s */}
    cost = cost * 0.9 + (performance.now() - t0) * 0.1; // EMA chi phí
    // …
  }
  handle = v.requestVideoFrameCallback(tick);
};
```
2. Kiến trúc đích: **chạy MediaPipe + classifier trong Web Worker**, main thread chỉ gửi `createImageBitmap(video)` (transferable) và nhận landmark. Worker còn giải quyết 2.5 (giải phóng bộ nhớ thật bằng `worker.terminate()`).
3. Không phát `LoopVideo` ở góc trong khi đang ghi (`phase === "recording"`) — dừng ở frame đầu.

### 2.2 [HIGH] Không xử lý camera bị ngắt / app xuống nền

**Hiện tượng & nguyên nhân gốc.** Không có `visibilitychange`, không có `track.onended` / `onmute` ở bất kỳ đâu (grep toàn bộ `app/`, `lib/`, `components/`). Vòng lặp chỉ xử lý khi `v.currentTime !== lastVideoTime` (`useSignPractice.ts:134`) → khi luồng chết, vòng lặp **im lặng không làm gì**, không báo lỗi.

**Worst-case.** iOS: có cuộc gọi, mở Control Center dùng camera, Siri, hoặc chuyển app → track bị `ended`/`muted`, `<video>` dừng. Quay lại app: khung camera đóng băng ở frame cuối, chip vẫn ghi "Tốt rồi · thấy 2 bàn tay" (state cũ), người dùng ký mãi không được chấm. Android: chuyển tab/app → rAF dừng nhưng **camera vẫn mở** (đèn xanh, tốn pin, app khác không dùng được camera).

**Giải pháp.**
```ts
const open = async () => {
  stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
  const [track] = stream.getVideoTracks();
  track.addEventListener("ended", () => { if (!document.hidden && !cancelled) void open(); });
  video.srcObject = stream;
  await video.play();
};
const close = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; };
const onVis = () => (document.hidden ? close() : void open());
document.addEventListener("visibilitychange", onVis);
// cleanup: document.removeEventListener("visibilitychange", onVis); close();
```
Thêm watchdog: nếu `currentTime` không đổi > 2 s trong khi `phase !== "loading"` → hiện "Camera bị gián đoạn — chạm để mở lại".

### 2.3 [MEDIUM] Mở/đóng camera mỗi lần đổi bước; bước "Soi gương" tải cả bộ chấm

**Hiện tượng.** `app/practice/page.tsx`: đổi `demo → mirror → practice` unmount/mount các hook khác nhau → `getUserMedia` dừng rồi xin lại mỗi lần (màn đen 0,5–2 s; Safari web không lưu quyền vĩnh viễn có thể hỏi lại). `MirrorPractice` (`:26`) gọi `useSignPractice` đầy đủ → tải classifier + bộ dò mặt + dò tay mỗi frame chỉ để vẽ khung xương. `useContinuousSign.ts:91` luôn tải `FaceDetector` kể cả khi `features === "hands"`.

**Worst-case.** Người dùng chuyển qua lại 3 bước vài lần → nhiều chu kỳ mở/đóng camera, iOS đôi khi trả `NotReadableError` khi xin lại quá nhanh → màn "Camera chưa được bật" dù đã cấp quyền.

**Giải pháp.** Một `CameraProvider` ở cấp trang, đếm tham chiếu luồng (ref-count), các bước chỉ gắn `srcObject` vào thẻ `<video>` của mình. Model và face detector tải lazy theo nhu cầu: `const fd = features === "face" ? await getFaceDetector() : null;`.

### 2.4 [MEDIUM] Rò rỉ Blob URL & setState sau unmount ở chế độ tự quay clip

**Hiện tượng & nguyên nhân gốc.** Cleanup ở `app/practice/page.tsx:43-51` gọi `mediaRecorderRef.current.stop()` khi đang ghi. `stop()` bắn `onstop` **bất đồng bộ sau khi đã unmount** → `onstop` (`:70-78`) tạo `URL.createObjectURL(blob)` mới — không ai revoke nữa — và gọi `setRecordedUrl`/`setRecording` trên component đã chết. Cùng lúc cleanup của `useSignPractice` dừng track mà MediaRecorder đang ghi.

**Worst-case.** Người dùng bấm "Quay 3 giây" rồi chuyển bước/thoát trang trong lúc quay, lặp lại nhiều lần → mỗi lần rò 1 blob video (~0,5–3 MB) nằm trong RAM tới khi đóng tab.

**Giải pháp.**
```ts
useEffect(() => () => {
  const mr = mediaRecorderRef.current;
  if (mr) {
    mr.ondataavailable = null;
    mr.onstop = null;               // tháo handler TRƯỚC khi stop
    if (mr.state !== "inactive") mr.stop();
  }
  if (recordTimeoutRef.current) clearTimeout(recordTimeoutRef.current);
  if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
}, []);
```

### 2.5 [HIGH] Bộ nhớ ML không bao giờ được giải phóng — rủi ro iOS giết tab

**Hiện tượng & nguyên nhân gốc.** `landmarker`, `faceDetector` (`handLandmarker.ts:14-15`) và mọi model TF.js (`classifier.ts:16-17`) là singleton sống suốt vòng đời app (SPA, chuyển trang không reload). Không có `.close()`, `model.dispose()`. Có **2 WebGL context** song song (GPU delegate của MediaPipe + backend WebGL của TF.js). Quan trọng: `WebAssembly.Memory` **chỉ tăng, không bao giờ co lại** — kể cả gọi `close()` thì heap WASM vẫn giữ nguyên kích thước; chỉ huỷ cả realm (reload trang hoặc terminate Worker) mới trả bộ nhớ.

**Worst-case.** iPhone 2–3 GB RAM (iPhone 8/SE 2/XR): luyện tập → sang từ điển (danh sách video) → quay lại luyện → WebKit báo memory pressure, tab bị kill, màn hình trắng/"Đã xảy ra sự cố lặp lại". Trong Capacitor WKWebView: web content process bị kill → app trắng xoá, người dùng tưởng app crash.

**Giải pháp.**
- Đích: MediaPipe + TF trong **Worker riêng**; rời trang camera quá 60 s → `worker.terminate()` → toàn bộ heap WASM + GL context được trả lại.
- Trước mắt: chỉ dùng **một** GPU context — chuyển classifier (nhỏ, 1,4 MB, chạy 1 lần/lần ký) sang backend `wasm` hoặc `cpu` của TF.js (`tf.setBackend("cpu")`); lần chấm là sự kiện thưa, không cần WebGL.
- Lắng nghe `webglcontextlost` / đếm lỗi liên tiếp trong `detectHands` (hiện nuốt lỗi và trả `[]` — `handLandmarker.ts:119-122` → app tưởng "không thấy tay" mãi mãi): ≥ 10 lỗi liên tiếp → `close()` và tạo lại với `delegate: "CPU"`.

### 2.6 [MEDIUM] Trò ghép cặp giải mã 4 video cùng lúc cho ô cao 52 px

**Hiện tượng.** `app/quiz/page.tsx:384-389` render 4 `LoopVideo` đồng thời trong ô `height: 52`. Mỗi cái là một bộ giải mã phần cứng chạy liên tục.

**Worst-case.** Android giá rẻ giới hạn số phiên giải mã phần cứng đồng thời → một vài ô rơi về giải mã phần mềm (nóng máy) hoặc đứng ở màu đen; người dùng không ghép được vì không thấy cử chỉ.

**Giải pháp.** Hiện ảnh `thumbUrl()` (đã có sẵn, `lib/theme.ts:49-51`) làm `poster`, chỉ phát video của ô đang được chọn/hover; hoặc xuất sẵn sprite/animated WebP nhỏ cho chế độ ghép cặp.

---

## 3. Đa nền tảng & lỗi trình duyệt

### 3.1 [HIGH] Đặc trưng xếp tay theo nhãn Left/Right của MediaPipe — nhãn mà chính code thừa nhận là hay đổi

**Hiện tượng & nguyên nhân gốc.** `buildFrameFeatures` đặt mỗi tay vào ô `slot[h.label]` (`lib/landmarks.ts:61-66`). Chú thích ở `lib/signSegmenter.ts:62-63` ghi rõ "MediaPipe hay đổi nhãn giữa chừng" — segmenter đã né vấn đề này, nhưng **bộ đặc trưng đưa vào model thì không**. Thêm nữa: khi MediaPipe trả **hai tay cùng nhãn** (xảy ra khi hai tay bắt chéo/chồng nhau), tay thứ hai **ghi đè** tay thứ nhất ở cùng ô (`frame.set(..., idx * fh)`) → mất hẳn một bàn tay trong frame đó.

**Worst-case.** Ký hiệu hai tay bắt chéo (rất phổ biến): vài frame giữa động tác bị hoán đổi 63 số trái/phải hoặc mất một tay → chuỗi 30 frame đưa vào model bị nhiễu đúng ở pha quan trọng nhất → nhận sai một cách khó tái hiện ("lúc đúng lúc sai").

**Giải pháp (tương thích với model hiện tại).** Giữ nguyên quy ước nhãn, chỉ xử lý va chạm bằng điểm tin cậy handedness (đang bị bỏ ở `handLandmarker.ts:107`):
```ts
// handLandmarker.ts: giữ lại score
out.push({ label: handed, score: res.handedness[i][0]?.score ?? 0, points });

// landmarks.ts: nếu hai tay cùng nhãn, tay có score thấp hơn chuyển sang ô còn lại
if (hands.length === 2 && hands[0].label === hands[1].label) {
  const [hi, lo] = hands[0].score >= hands[1].score ? [hands[0], hands[1]] : [hands[1], hands[0]];
  hands = [hi, { ...lo, label: hi.label === "Left" ? "Right" : "Left" }];
}
```
Dài hạn: thêm độ trễ nhãn (hysteresis) theo vết tay của segmenter. Bất kỳ thay đổi featurizer nào **phải** được mô phỏng lại trong `training/eval/try_models.py` trước khi ship.

### 3.2 [HIGH] FPS tụt → lấy mẫu lặp frame → lệch phân phối so với dữ liệu train

**Hiện tượng & nguyên nhân gốc.** Segmenter tính theo thời gian (tốt), nhưng `resampleSequence` (`lib/landmarks.ts:87-96`) chọn frame **theo chỉ số gần nhất**, bỏ qua timestamp. Ở 8 fps, một lần ký 1,2 s ≈ 10 frame → mỗi frame bị nhân 3 lần để đủ 30. Model train trên clip 25–30 fps → chuỗi "bậc thang" là phân phối nó chưa từng thấy. `MIN_FRAMES: 4` (`signSegmenter.ts:19`) cho phép chấm cả chuỗi 4 frame.

**Worst-case.** Thiếu sáng → camera tự giảm fps (iOS/Android tăng thời gian phơi sáng, thường xuống 15 fps hoặc thấp hơn) cộng máy nóng (2.1) → độ chính xác giảm mạnh, đúng nhóm người dùng có thiết bị kém nhất. *(Mức giảm cụ thể chưa đo — repo không có đánh giá theo fps.)*

**Giải pháp.**
1. Lưu timestamp cùng frame trong segmenter; nội suy tuyến tính theo thời gian (với ô tay vắng mặt = toàn 0 thì lấy frame gần nhất, không nội suy, để không tạo "nửa bàn tay").
2. Bổ sung augmentation giảm fps (5–30 fps) khi train, và thêm kịch bản "fps thấp" vào `report_vsl.json` giống các kịch bản "đứng yên 2 đầu", "thuận tay trái" đang có.
3. Đo fps thực và cảnh báo: `track.getSettings().frameRate` + đếm số detect/giây; < 12 → chip "Thiếu sáng — bật thêm đèn".
4. Ràng buộc camera rõ ràng: `{ width: 640, height: 480, frameRate: { ideal: 30, max: 30 } }` (`useSignPractice.ts:94`) để tránh máy mở 60 fps làm gấp đôi tải.

### 3.3 [MEDIUM] Âm thanh & giọng đọc trên iOS/Android

**Hiện tượng.** `AudioContext` được tạo lười trong `signal()` (`lib/feedback.ts:140-153`), tức là sau một kết quả chấm **bất đồng bộ**, không nằm trong cử chỉ người dùng → trên iOS context ở trạng thái `suspended`, `resume()` không có hiệu lực ngoài gesture → tiếng "ding" đầu tiên (thường là cả phiên ở chế độ tự chấm, vốn không cần chạm) bị mất. Công tắc im lặng iOS tắt Web Audio — chấp nhận được vì app visual‑first. `speakVietnamese` (`:175-190`) có race: cả `onvoiceschanged` và fallback 250 ms đều có thể gọi `speak()` → đọc 2 lần; nhiều máy Android không có giọng `vi-VN` → đọc tiếng Việt bằng giọng Anh.

**Giải pháp.** Mở khoá audio ở lần chạm đầu tiên (`pointerdown` một lần → `ctx.resume()`); dùng cờ `spoken` để chỉ `speak()` một lần; nếu không có giọng `vi` thì ẩn nút loa thay vì đọc sai.

### 3.4 [LOW] Deep link bỏ qua `basePath`

`components/PWARegister.tsx:21-29` gán `window.location.assign(targetPath)` với đường dẫn không có `NEXT_PUBLIC_BASE_PATH` → trên GitHub Pages (`/VSL`) deep link `vslv://...` ra 404. Thêm `asset()`/basePath khi dựng `targetPath`.

---

## 4. Kiến trúc dữ liệu & đồng bộ

### 4.1 [CRITICAL] Safari xoá toàn bộ tiến độ sau 7 ngày không mở — đúng nhóm người dùng cần giữ chân nhất

**Hiện tượng & nguyên nhân gốc.** Toàn bộ trạng thái (tiến độ SRS, chuỗi ngày, XP, hồ sơ, từ đã lưu) nằm trong `localStorage` (`lib/progress.ts`, `lib/profile.ts`, `lib/saved.ts`). Safari (ITP) xoá dữ liệu script-writable của site **không được thêm vào màn hình chính** sau 7 ngày dùng Safari mà không tương tác với site. Không gọi `navigator.storage.persist()`, không có export/import, không có sync.

**Worst-case.** Người học trên iPhone nghỉ 1 tuần (ốm, thi cử) → quay lại: chuỗi ngày = 0, toàn bộ lịch ôn Leitner mất, bị đưa lại màn chào mừng. Đây chính xác là thời điểm app cần giữ người dùng — và là lúc app "phạt" nặng nhất. Đổi máy/xoá dữ liệu trình duyệt: mất hết, không cách khôi phục.

**Giải pháp (3 tầng).**
```ts
// 1. Xin lưu trữ bền (Chrome/Android cấp tự động cho PWA đã cài; Safari bỏ qua nhưng vô hại)
export async function requestPersist() {
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch {}
}
// 2. Sao lưu thủ công: xuất/nhập 1 file JSON (hoặc mã QR) chứa vsl-progress-v1, vsl-profile-v1, khoá saved
export function exportBackup(): Blob {
  const keys = ["vsl-progress-v1", "vsl-profile-v1" /*, khoá của saved.ts */];
  const data = Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)]));
  return new Blob([JSON.stringify({ v: 1, at: Date.now(), data })], { type: "application/json" });
}
```
3. Đồng bộ đám mây tuỳ chọn (Supabase/Firebase, đăng nhập ẩn danh → liên kết email sau). Hợp nhất theo từng từ: lấy `max(attempts)`, `max(correct)`, `last` mới nhất; `days` hợp theo khoá với `max`. Trong bản Capacitor, chuyển sang `@capacitor/preferences` hoặc SQLite thay vì `localStorage` của WebView.
4. Ở web iOS: nhắc "Thêm vào màn hình chính" sau buổi học thứ 2 — PWA đã cài không bị giới hạn 7 ngày.

### 4.2 [MEDIUM] Một blob JSON, read-modify-write, không version, lỗi là reset im lặng

**Hiện tượng.** `recordAttempt` (`lib/progress.ts:74-97`) đọc toàn bộ → sửa → ghi đè toàn bộ. Hai tab cùng mở → last-write-wins, tab sau xoá kết quả của tab trước. Không có lược đồ version/migration (chỉ có hậu tố `-v1` trong khoá + spread mặc định). `loadProgress` gặp JSON hỏng → trả `emptyProgress()` (`:43-45`), và lần `save` kế tiếp **ghi đè vĩnh viễn** dữ liệu cũ có thể còn cứu được.

**Giải pháp.** Trước khi ghi đè một bản không parse được, chép nó sang `vsl-progress-v1.corrupt-<ts>`; thêm trường `schema: 2` + hàm `migrate()`; nghe sự kiện `storage` để đồng bộ giữa các tab; dài hạn tách bản ghi theo từng từ (IndexedDB, một object store `words` khoá theo từ) để cập nhật nguyên tử từng dòng.

### 4.3 [MEDIUM] "Khiên bảo vệ chuỗi" không bao giờ bị tiêu hao

**Hiện tượng & nguyên nhân gốc.** `dayStreak` (`lib/progress.ts:121-152`) mỗi lần tính lại đều cho `availableFreeze = p.streakFreeze ?? 2` khiên "ảo", nhưng **không bao giờ giảm `streakFreeze`** và không ghi lại ngày đã dùng khiên. Kết quả: mọi người dùng luôn được bỏ 2 ngày bất kỳ trong mỗi chuỗi mà không mất gì; bộ đếm khiên hiển thị mãi là 2; không có cơ chế kiếm thêm khiên. Commit `0f2137f` ghi "fix streak freeze bug" nhưng logic tiêu hao vẫn không tồn tại.

**Giải pháp.** Lưu `freezeDays: string[]` (các ngày đã được khiên che). Khi phát hiện ngày hụt mới (lúc mở app), nếu `streakFreeze > 0` thì đẩy ngày đó vào `freezeDays`, giảm `streakFreeze`, `save()`. `dayStreak` chỉ coi ngày là "đạt" nếu `days[d] >= goal || freezeDays.includes(d)`.

### 4.4 [HIGH khi scale] Từ điển là một file JSON nguyên khối, tìm kiếm chuẩn hoá lại mọi mục mỗi phím gõ

**Hiện tượng & nguyên nhân gốc.** `/data/qipedc.json` (0,4 MB, 3.315 mục) tải và `JSON.parse` toàn bộ trên main thread (`lib/qipedc.ts:47-55`), không cache SW. Tìm kiếm: mỗi lần `q` đổi, `fold(e.w)` (NFD normalize + regex) chạy lại cho **toàn bộ** mục (`app/tu-dien/page.tsx:254-263`) và cho danh sách nhãn (`:126-129`) — không debounce, không tính trước khoá.

**Worst-case (50.000 biến thể vùng miền).** JSON ~6–8 MB, parse 0,3–0,8 s đứng hình trên Android giá rẻ ở mỗi lần vào trang; mỗi phím gõ 50.000 lần NFD normalize → ô tìm kiếm trễ thấy rõ. *(Ước lượng tuyến tính từ kích thước hiện tại.)*

**Giải pháp.**
- Ngay: tính trước khoá một lần và hoãn tìm kiếm
```ts
const keyed = useMemo(() => entries.map((e) => [fold(e.w), e] as const), [entries]);
const dq = useDeferredValue(q);
```
- Build-time (`training/qipedc/build_dict.py`): ghi sẵn trường khoá không dấu, chia shard theo chữ cái đầu (`/data/dict/a.json`…) + một chỉ mục prefix nhỏ; tìm kiếm trong Worker. Ở quy mô hàng chục nghìn mục: FlexSearch hoặc sqlite‑wasm (OPFS) để tra offline.

---

## 5. Tính khả thi ML & trải nghiệm thực tế

### 5.1 [CRITICAL] App báo "ĐÚNG" cho gần một nửa số lần ký SAI — theo chính số liệu của dự án

**Hiện tượng & nguyên nhân gốc.** `lib/constants.ts:21-24` ghi lại hiệu chỉnh trên người ký lạ: ở ngưỡng 0,4, **89% lần ký đúng được báo Đúng, nhưng 40% lần ký sai cũng lọt** (≈ 8% tổng số lần). `training/eval/report_clean.json`: chia ngẫu nhiên top‑1 = 88,5%, nhưng **người ký chưa gặp: top‑1 = 64%, "sai mà chắc" = 19,4%**, có fold chỉ 55,7%. Con số marketing (88%) đến từ cách chia làm lộ người ký — con số thực tế người dùng gặp là ~64%. Dữ liệu: 2.642 video gốc từ 46 buổi quay (`report_clean.json`, `models/vsl/info.json`) cho 100 từ — quá ít người ký để tổng quát hoá.

UI hiện tại hiển thị kết quả nhị phân rất dứt khoát: "CHÍNH XÁC! +10 XP" kèm pháo hoa (`app/practice/page.tsx:417-421`).

**Worst-case.** Với một app *dạy* ngôn ngữ, false accept nguy hiểm hơn false reject: người học ký sai hình tay/vị trí, được thưởng XP + pháo hoa, thuật toán Leitner đẩy từ đó lên hộp cao → **củng cố một ký hiệu sai** và lịch ôn lùi xa. Người Điếc bản ngữ dùng thử thấy app chấm đúng cho động tác sai → mất uy tín trong cộng đồng, thứ rất khó lấy lại.

**Giải pháp.**
1. Thay kết quả nhị phân bằng 3 vùng: **Đúng** (conf ≥ ngưỡng cao *và* khoảng cách top1–top2 đủ lớn) / **Gần đúng — xem lại mẫu** / **Chưa đúng**. Chỉ vùng "Đúng" mới đẩy hộp Leitner lên.
2. Ngưỡng **theo từng từ** (hiệu chỉnh trên tập người ký lạ), không một ngưỡng chung 0,4.
3. Cổng phát hành: model mới chỉ được ship nếu chỉ số "người ký chưa gặp" (không phải chia ngẫu nhiên) đạt mức tối thiểu đặt trước; đưa vào CI cùng `report_*.json`.
4. Thu thập dữ liệu: ưu tiên **số người ký** (giới tính, tuổi, màu da, tay thuận, vùng miền) hơn số clip mỗi người.

### 5.2 [HIGH] Bộ đặc trưng không đủ cho ngôn ngữ ký hiệu thật

**Hiện tượng & nguyên nhân gốc.** Chỉ có landmark bàn tay chuẩn hoá theo cổ tay + 4 số vị trí so với khung mặt (`lib/landmarks.ts:57-84`). Thiếu:
- **Pose (vai, khuỷu):** không phân biệt được ký hiệu cùng hình tay khác vị trí/hướng cánh tay.
- **Biểu cảm khuôn mặt (non-manual markers):** trong VSL, câu hỏi/phủ định/mức độ mang nghĩa ngữ pháp qua mặt — với chế độ "Dịch câu" đây là thiếu sót về bản chất, không phải tinh chỉnh.
- **Trục z:** `z` của MediaPipe là độ sâu tương đối so với cổ tay, ước lượng từ ảnh 2D, nhiễu cao — ký hiệu chuyển động tiến/lùi về phía camera gần như không phân biệt được.
- **Che khuất:** tay chồng tay, tay che mặt → landmarker mất dấu hoặc trả landmark sai (code đã thấy hiện tượng này: `GONE_MS: 1000` vì "bộ dò hay mất dấu tay 0,5–0,9 giây", `signSegmenter.ts:15-17`).
- **Áo/nền trùng màu da, thiếu sáng:** bộ dò lòng bàn tay giảm độ nhạy; repo không có đánh giá theo điều kiện này.

Lưu ý tích cực có số liệu: model mới đã xử lý tốt tay trái (`report_vsl.json`: top‑1 79,9% so với 13,3% ở model cũ) — cách làm (augmentation lật gương + đánh giá theo kịch bản) là đúng hướng, cần mở rộng ra các trục còn thiếu ở trên.

**Giải pháp.** Thêm `PoseLandmarker` lite chỉ lấy 6 điểm thân trên (vai, khuỷu, cổ tay), chuẩn hoá theo bề ngang vai; chạy ở tần số thấp hơn dò tay. Cho chế độ câu: `FaceLandmarker` với blendshapes (nhíu mày, nhướng mày, lắc đầu) ở ~5 Hz. Đánh giá theo kịch bản như `report_vsl.json` cho: thiếu sáng, áo trùng màu da, tay chồng tay.

### 5.3 [HIGH] Không thể mở rộng classifier từ 100 lên 5.000 từ bằng kiến trúc hiện tại

**Hiện tượng.** Model là softmax 100 lớp (`labels.json`: 100 nhãn) train trên ~26 clip/từ. `training/qipedc/report_cross.json`: khi thử đối chiếu với video từ điển QIPEDC, phương án tốt nhất (A) chỉ đạt **top‑1 = 1,4%, top‑5 = 3,4% trên toàn bộ từ vựng** (AUC 0,73). Tức là: không có đường tắt "dùng video từ điển làm dữ liệu train" — mỗi từ mới cần quay dữ liệu nhiều người ký.

**Worst-case.** Lộ trình sản phẩm hứa "chấm điểm cho toàn bộ từ điển" là không khả thi về dữ liệu (5.000 từ × 26 clip ≈ 130.000 clip có nhãn, chưa tính đa dạng người ký). Softmax 5.000 lớp với dữ liệu mỏng sẽ có confusion rất cao giữa các ký hiệu tương tự.

**Giải pháp kiến trúc.** Chuyển từ phân loại đóng sang **xác minh (verification)**: app luôn biết người dùng *đang tập từ nào*, nên chỉ cần trả lời "lần ký này có khớp với từ X không" → train encoder embedding (metric learning / contrastive) + so khớp với vài mẫu chuẩn của từ X. Bài toán nhị phân theo từ dễ hơn nhiều so với 5.000 lớp, và thêm từ mới chỉ cần vài mẫu tham chiếu. Ở trang từ điển, nói rõ từ nào "có chấm điểm" và từ nào chỉ để xem (đã có `trainedSet`, cần đưa thành nhãn hiển thị rõ ràng).

### 5.4 [HIGH] Phân đoạn bằng ngưỡng tốc độ + cử chỉ "vẫy tay" kích hoạt nhầm

**Hiện tượng & nguyên nhân gốc.**
- Segmenter (`lib/signSegmenter.ts:10-21`) là heuristic thuần: chuyển động > 0,12 đơn vị/s trong ≥ 350 ms rồi đứng yên 500 ms = một lần ký. Mọi cử động tay khác (gãi mặt, chỉnh kính, vuốt tóc, với lấy điện thoại) đều thoả điều kiện này. `MAX_MS: 3500` cắt đôi ký hiệu ghép dài. Với **câu ký liên tục**, người ký bản ngữ không dừng 0,5 s giữa các từ (co-articulation) → segmenter hoặc gộp nhiều từ thành một đoạn, hoặc cắt ở MAX_MS giữa chừng.
- `isOpenPalmWave` (`lib/useSignPractice.ts:40-58`) **không kiểm tra chuyển động vẫy** — chỉ cần bàn tay xoè, ngón hướng lên, ở nửa trên khung, trong 4 frame (`:162-166`). Rất nhiều ký hiệu và chữ cái ngón tay có hình tay này → ở chế độ bấm nút, đang ký thử/ký mẫu là app tự đếm ngược và bắt đầu ghi.

**Worst-case.** Chế độ tự chấm: người dùng gãi mũi → app chấm → "CHƯA ĐÚNG" + rung báo sai, lặp lại → người dùng không hiểu vì sao bị chấm sai khi mình chưa ký. Chế độ "Dịch ký hiệu": một câu 5 từ ra 1–2 kết quả rác.

**Giải pháp.**
1. Vẫy tay thật: yêu cầu cổ tay đổi chiều theo trục x ≥ 2 lần trong 1 s, biên độ ≥ 0,05, cộng thời gian chờ 2 s sau mỗi lần kích hoạt.
2. Lọc đoạn trước khi chấm: loại đoạn mà tay ở trong vùng mặt với biên độ nhỏ (pattern gãi/chỉnh kính), loại đoạn có tay chỉ xuất hiện ở mép khung.
3. Dài hạn cho dịch câu: một mạng nhỏ "đang ký / không ký" theo từng frame (GRU nhỏ trên đặc trưng sẵn có) thay ngưỡng tốc độ; nhận diện liên tục bằng CTC thay vì cắt từng từ rồi phân loại. Đến lúc đó, chế độ "Dịch câu" nên ghi rõ là thử nghiệm.

---

## 6. Bảo mật, quyền riêng tư & bản quyền

### 6.1 [MEDIUM] Camera xử lý trên máy thật — nhưng không có cơ chế *bảo đảm* điều đó

**Đã kiểm chứng:** không có đoạn code nào gửi frame/landmark ra mạng; clip tự quay chỉ là Blob URL cục bộ (`app/practice/page.tsx:73-74`). Đây là điểm mạnh thật về quyền riêng tư.

**Hiện tượng & rủi ro.** Không có CSP, và GitHub Pages không cho đặt header → không có lớp chặn ở trình duyệt. Một dependency bị chèn mã (supply-chain) hoặc một lỗi XSS trong tương lai có thể `fetch()` frame canvas ra ngoài mà không gì ngăn. Còn sót móc debug `window.__vslSegments` trong production (`lib/useContinuousSign.ts:69-70`) — vô hại hiện tại nhưng là mã test lọt vào bản phát hành. Mỗi lượt xem video từ điển gửi IP người dùng tới `qipedc.moet.gov.vn` (bên thứ ba) — cần nêu trong trang quyền riêng tư.

**Giải pháp.** CSP qua `<meta>` trong `app/layout.tsx` (dùng được trên host tĩnh), khoá `connect-src` về `'self'` để chặn đường rò dữ liệu:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; connect-src 'self'; media-src 'self' blob: https://qipedc.moet.gov.vn; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; form-action 'self'">
```
(`'unsafe-inline'` cho script là bắt buộc với inline script của Next App Router khi export tĩnh; giá trị chính ở đây là `connect-src`/`media-src`. Phải test kỹ việc MediaPipe tải WASM/loader dưới CSP này.) Bọc móc debug trong `process.env.NODE_ENV !== "production"`. Trên host mới: thêm `Permissions-Policy: camera=(self)`.

### 6.2 [MEDIUM] Bản quyền: rủi ro lớn nhất là chiều ngược lại

**Hiện tượng.** Đề bài lo người khác cào dữ liệu của bạn. Thực tế:
- **Tài sản thật của bạn** là model đã train (`public/models/vsl/*.bin`, 1,39 MB) + 100 video mẫu + `labels.json`. Với ML trên thiết bị, trọng số **bắt buộc** phải về tới máy người dùng — không có cách kỹ thuật nào chặn sao chép triệt để (signed URL vô nghĩa vì client hợp lệ vẫn phải tải được). Ai cũng tải được 3 file và dùng model của bạn trong 5 phút.
- **Rủi ro pháp lý lớn hơn** là app đang phân phối 4.362 video của Bộ GD&ĐT mà repo không có giấy phép đi kèm (mục 1.3).

**Giải pháp thực tế.** (1) Giấy phép rõ ràng cho model và video tự quay (vd. CC BY-NC cho video, điều khoản sử dụng cho model) — bảo vệ bằng pháp lý, không bằng kỹ thuật. (2) Watermark nhẹ trên video mẫu tự quay. (3) Trên Cloudflare: rate limit theo IP cho `/samples/*` và `/models/*` để chặn cào hàng loạt (không chặn được người kiên nhẫn, nhưng chặn được script). (4) Xin giấy phép QIPEDC (mục 1.3) — việc này quan trọng hơn mọi biện pháp chống cào.

---

## 7. Ma trận rủi ro kỹ thuật

| ID | Vấn đề | Mức độ | Khả năng xảy ra | Vị trí |
|---|---|---|---|---|
| 1.1 | Hai nhánh cùng deploy đè production | **Critical** | **Chắc chắn** (đang xảy ra mỗi lần push nhánh redesign) | `.github/workflows/pages.yml:7` |
| 5.1 | Báo "Đúng" cho ~40% lần ký sai; người ký lạ top‑1 chỉ 64% | **Critical** | **Chắc chắn** (đo bởi chính dự án) | `lib/constants.ts:21-24`, `training/eval/report_clean.json` |
| 4.1 | Safari xoá tiến độ sau 7 ngày; không backup/sync | **Critical** | Cao (mọi người dùng web iOS nghỉ ≥ 1 tuần) | `lib/progress.ts`, `lib/profile.ts`, `lib/saved.ts` |
| 1.3 | Từ điển hotlink 4.362 video server Bộ GD&ĐT, không giấy phép, không xử lý lỗi | **Critical** | Trung bình | `lib/qipedc.ts:31-33` |
| 1.2 | GitHub Pages: trần băng thông, không header, không immutable cache | **Critical** khi scale | Trung bình → Cao khi tăng trưởng | Hosting |
| 1.4 | SW no-op; `visionP` lỗi bị cache vĩnh viễn trong phiên | High | Cao (mạng yếu VN) | `public/sw.js`, `lib/handLandmarker.ts:17` |
| 2.1 | Pipeline main-thread, không trần FPS, không quản lý nhiệt | High | Cao (máy tầm thấp) | `lib/useSignPractice.ts:122-180`, `lib/useContinuousSign.ts:93-139` |
| 2.2 | Không xử lý track ended / visibility → camera đóng băng (iOS), camera mở nền (Android) | High | Cao | các hook camera |
| 2.5 | Heap WASM + 2 WebGL context không bao giờ giải phóng | High | Trung bình (iPhone RAM thấp, Capacitor) | `lib/handLandmarker.ts:14-15`, `lib/classifier.ts:16-17` |
| 3.1 | Xếp tay theo nhãn Left/Right; 2 tay cùng nhãn → ghi đè | High | Trung bình (ký hiệu bắt chéo) | `lib/landmarks.ts:61-66` |
| 3.2 | Lấy mẫu theo chỉ số khi FPS tụt → lệch phân phối | High | Cao (thiếu sáng, máy nóng) | `lib/landmarks.ts:87-96` |
| 5.2 | Thiếu pose, biểu cảm mặt; z nhiễu; che khuất | High | Chắc chắn (giới hạn thiết kế) | `lib/landmarks.ts:57-84` |
| 5.3 | Không mở rộng được 100 → 5.000 từ (cross-dataset top‑1 1,4%) | High | Chắc chắn nếu theo lộ trình hiện tại | `training/qipedc/report_cross.json` |
| 5.4 | Segmenter heuristic bắt nhầm; "vẫy tay" không kiểm tra vẫy | High | Cao | `lib/signSegmenter.ts:10-21`, `lib/useSignPractice.ts:40-58` |
| 4.4 | Từ điển JSON nguyên khối, fold lại mọi mục mỗi phím gõ | High khi scale | Thấp hiện tại / Cao ở 50k mục | `lib/qipedc.ts:47`, `app/tu-dien/page.tsx:254-263` |
| 2.3 | Mở lại camera mỗi bước; "Soi gương" tải cả bộ chấm | Medium | Cao | `app/practice/page.tsx:26` |
| 2.4 | Blob URL rò + setState sau unmount khi thoát lúc đang quay | Medium | Trung bình | `app/practice/page.tsx:43-78` |
| 2.6 | 4 bộ giải mã video đồng thời ở trò ghép cặp | Medium | Trung bình (Android rẻ) | `app/quiz/page.tsx:384-389` |
| 4.2 | Last-write-wins giữa tab, không version, JSON hỏng → ghi đè | Medium | Thấp | `lib/progress.ts:37-97` |
| 4.3 | Khiên chuỗi không bao giờ bị tiêu hao | Medium | Chắc chắn | `lib/progress.ts:121-152` |
| 3.3 | Audio không mở khoá trên iOS; TTS đọc 2 lần / sai giọng | Medium | Cao (iOS, Android thiếu giọng vi) | `lib/feedback.ts:140-193` |
| 6.1 | Không CSP; móc debug trong production | Medium | Thấp | `app/layout.tsx`, `lib/useContinuousSign.ts:69` |
| 6.2 | Model/video sao chép tự do; nội dung QIPEDC chưa có giấy phép | Medium | Trung bình | `public/models`, `public/samples` |
| 1.5 | "Tua 1 frame" = 60 ms cố định | Low | Chắc chắn | `components/LoopVideo.tsx:265,321` |
| 3.4 | Deep link bỏ qua basePath | Low | Thấp | `components/PWARegister.tsx:21-29` |

---

## 8. Lộ trình hành động

### P0 — Chặn đứng lỗi nghiêm trọng (tuần này)

| # | Việc | Liên quan | Công sức |
|---|---|---|---|
| 1 | Chỉ deploy production từ `main`; preview riêng cho nhánh | 1.1 | 10 phút |
| 2 | UI 3 vùng (Đúng / Gần đúng / Chưa đúng), chỉ "Đúng" mới lên hộp Leitner; bỏ pháo hoa ở vùng biên | 5.1 | 1–2 ngày |
| 3 | Xuất/nhập file sao lưu + `navigator.storage.persist()` + nhắc "Thêm vào màn hình chính" trên iOS | 4.1 | 1 ngày |
| 4 | `onError` + thông báo cho mọi video QIPEDC; gửi văn bản xin phép sử dụng tới QIPEDC | 1.3, 6.2 | 0,5 ngày + pháp lý |
| 5 | Xoá `visionP` khi reject để thử lại được | 1.4 | 5 phút |
| 6 | Xử lý `visibilitychange` + `track ended` + watchdog camera đóng băng | 2.2 | 0,5 ngày |
| 7 | Sửa rò Blob URL/MediaRecorder khi unmount | 2.4 | 30 phút |
| 8 | Xử lý hai tay cùng nhãn bằng điểm handedness (kèm chạy lại `try_models.py`) | 3.1 | 0,5–1 ngày |

### P1 — Tối ưu hiệu năng & độ tin cậy (2–6 tuần)

| # | Việc | Liên quan |
|---|---|---|
| 1 | Trần 15 Hz + điều chỉnh theo chi phí đo được bằng `requestVideoFrameCallback`; dò mặt ~3 Hz; ràng buộc `frameRate` | 2.1, 3.2 |
| 2 | Đo thật trên 3 máy chuẩn (Android 3 GB, iPhone 2–3 GB, laptop): ms/frame, fps, nhiệt độ sau 10 phút, RAM — biến các ước lượng trong báo cáo này thành số đo | 2.1, 2.5 |
| 3 | Classifier TF.js sang backend CPU/WASM (chỉ còn 1 GPU context); lazy face detector; `CameraProvider` dùng chung luồng | 2.3, 2.5 |
| 4 | Lấy mẫu chuỗi theo thời gian + augmentation giảm fps khi train + kịch bản "fps thấp" trong báo cáo đánh giá | 3.2 |
| 5 | Vẫy tay thật (đổi chiều x) + lọc đoạn rác (gãi mặt, mép khung) | 5.4 |
| 6 | Ngưỡng theo từng từ; cổng phát hành theo chỉ số "người ký chưa gặp" trong CI | 5.1 |
| 7 | Tính trước khoá tìm kiếm + `useDeferredValue`; poster + phát-khi-chọn ở trò ghép cặp | 4.4, 2.6 |
| 8 | Khiên chuỗi tiêu hao thật; version lược đồ + giữ bản hỏng; đồng bộ giữa tab | 4.2, 4.3 |
| 9 | Mở khoá audio ở lần chạm đầu; sửa TTS đọc 2 lần; CSP qua `<meta>`; gỡ móc debug | 3.3, 6.1 |

### P2 — Mở rộng hạ tầng & kiến trúc (1–3 tháng)

| # | Việc | Liên quan |
|---|---|---|
| 1 | Chuyển hosting sang Cloudflare Pages + R2; đường dẫn có version; `_headers` immutable; SW cache-first cho asset ML | 1.2, 1.4 |
| 2 | Mirror + transcode video QIPEDC (360p, faststart, GOP 0,5 s) **sau khi có giấy phép** | 1.3, 1.5 |
| 3 | MediaPipe + classifier trong Web Worker; terminate khi rời trang camera để trả heap WASM | 2.1, 2.5 |
| 4 | Đồng bộ đám mây tuỳ chọn (đăng nhập ẩn danh) với hợp nhất theo từng từ; Capacitor dùng Preferences/SQLite | 4.1, 4.2 |
| 5 | Từ điển chia shard + chỉ mục build-time + tìm kiếm trong Worker (FlexSearch / sqlite-wasm) | 4.4 |
| 6 | Chuyển nhận diện sang xác minh theo từ (embedding + mẫu tham chiếu) để mở rộng từ vựng; chương trình thu thập dữ liệu đa người ký | 5.3, 5.1 |
| 7 | Thêm pose thân trên; với dịch câu: biểu cảm mặt + nhận diện liên tục (CTC) thay vì cắt-rồi-phân-loại | 5.2, 5.4 |

---

### Ghi chú về giới hạn của audit này
- Đã kiểm chứng trực tiếp: kích thước mọi asset, cấu hình deploy, toàn bộ luồng camera/ML/lưu trữ, faststart của 100 video mẫu, số liệu đánh giá trong `training/`.
- **Chưa đo** (cần thiết bị thật, ghi rõ là ước lượng trong bài): ms/frame trên máy tầm thấp, mức giảm độ chính xác theo fps, ngưỡng RAM khiến iOS kill tab, tỉ lệ nén WASM của host.
- Không audit: mã training Python ngoài các file báo cáo, project native `ios/`/`android/` ngoài `capacitor.config.ts`.
