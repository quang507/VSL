# VSLV — Học Ngôn Ngữ Ký Hiệu Việt Nam

Web app học ngôn ngữ ký hiệu VSL: bật camera → ký hiệu → AI chấm đúng/sai.
**Chạy 100% trong trình duyệt** (MediaPipe WASM + TensorFlow.js), không cần
server → deploy Vercel miễn phí.

## Dùng thử

Bản web mới nhất: **https://quang507.github.io/VSL/** (mở bằng Safari trên iPhone hoặc Chrome trên Android, cho phép quyền camera).

Tự động deploy bằng GitHub Actions mỗi khi push lên `main` hoặc `redesign-vslv` (`.github/workflows/pages.yml`).

## Kiểm thử

```bash
npm run build
npm run test:e2e
```

Kế hoạch kiểm thử và kiểm định UX: [docs/TEST_PLAN.md](docs/TEST_PLAN.md).

## Công nghệ

- **Next.js 14** (App Router)
- **@mediapipe/tasks-vision** — nhận diện 21 điểm khớp tay, real-time
- **@tensorflow/tfjs** — chạy model phân loại trong browser

> Repo này tách ra từ [Finding-picture](https://github.com/quang507/Finding-picture) — app web nằm ở gốc repo, pipeline train model nằm trong `training/`.

## Chạy local

```bash
npm install
npm run dev
# mở http://localhost:3000
```

> Trước khi có model, app vẫn chạy: xem danh sách từ + bật camera.
> Để AI chấm điểm, chạy pipeline trong `training/` (xem `training/README.md`)
> rồi reload — model nằm ở `public/models/vsl/`.

## Deploy lên Vercel

1. Push repo lên GitHub.
2. Vào [vercel.com](https://vercel.com) → New Project → import repo.
3. **Root Directory**: để mặc định (app nằm ở gốc repo).
4. Framework tự nhận **Next.js** → Deploy.

Không cần biến môi trường, không cần server. Domain miễn phí dạng
`ten-app.vercel.app`.

> Lưu ý: camera (`getUserMedia`) chỉ chạy trên **HTTPS** — Vercel mặc định
> HTTPS nên OK. Khi test local, `localhost` cũng được coi là an toàn.

## Luồng hoạt động

```
Webcam → MediaPipe HandLandmarker (WASM) → 21 điểm/tay mỗi frame
       → chuẩn hoá (lib/landmarks.ts) → buffer 30 frame
       → TF.js model (lib/classifier.ts) → nhãn + độ tin cậy
       → so với từ đang luyện → "Đúng rồi!" / "Chưa đúng"
```

## Cấu trúc

```
app/
  page.tsx            danh sách từ
  practice/page.tsx   chế độ luyện (camera + chấm điểm)
lib/
  constants.ts        hằng số (PHẢI khớp training/config.py)
  landmarks.ts        chuẩn hoá landmark (PHẢI khớp landmark_utils.py)
  handLandmarker.ts   khởi tạo MediaPipe
  classifier.ts       load model TF.js + dự đoán
public/
  labels.json         danh sách nhãn (do bước 4 ghi đè)
  models/vsl/         model TF.js (do bước 4 tạo)
```

## Giao diện VSLV (nhánh `redesign-vslv`)

Giao diện làm lại theo thiết kế Figma VSLV: lộ trình theo chặng, luyện camera 2 bước
(xem mẫu → tập & chấm), đố vui, ôn tập Leitner, thẻ ghi nhớ, từ điển tìm không dấu,
hồ sơ + thống kê + huy hiệu, cài đặt. Phản hồi đúng/sai bằng **rung + nháy viền màn hình**
(âm thanh là tuỳ chọn cho người nghe).

| Trang | Đường dẫn |
|---|---|
| Chào mừng (lần đầu) | `/chao-mung` |
| Lộ trình | `/` |
| Bài học | `/lesson?id=…` |
| Luyện ký hiệu | `/practice?word=…` |
| Luyện tập | `/luyen-tap` |
| Đố vui / Ôn tập | `/quiz`, `/quiz?mode=review` |
| Thẻ ghi nhớ | `/the-ghi-nho` |
| Từ điển | `/tu-dien` |
| Hồ sơ | `/ho-so` |
| Cài đặt | `/cai-dat` |

## Video mẫu

`public/samples/<nhãn>.mp4` lấy từ **ViSignLanguage-Video** (PTIT AI Challenge, tác giả
`star092304` trên Hugging Face), giấy phép **CC-BY-4.0** — phải giữ dòng ghi nguồn trong app.

```bash
pip install remotezip huggingface_hub imageio-ffmpeg
python training/fetch_samples.py      # 1 video/nhãn, chỉ kéo đúng file cần
python training/transcode_samples.py  # chuyển mpeg4 → H.264 cho trình duyệt/iOS
```

## Đóng gói app iOS / Android (Capacitor)

Web xuất tĩnh vào `out/` (`next.config.js` → `output: "export"`), Capacitor bọc thành app.

```bash
npm run cap:sync      # build web + chép vào android/ và ios/
npm run cap:android   # mở Android Studio → Build → Generate Signed Bundle (.aab)
npm run cap:ios       # (cần máy Mac + Xcode) → Product → Archive
```

- Android: cần Android Studio (kèm JDK + SDK). Quyền camera đã khai báo trong `AndroidManifest.xml`.
- iOS: cần macOS + Xcode. `NSCameraUsageDescription` đã có trong `Info.plist`.
- Đăng store cần tài khoản nhà phát triển: Google Play (25 USD, một lần), Apple (99 USD/năm),
  kèm trang chính sách quyền riêng tư.
- MediaPipe đang tải WASM/model từ CDN → app cần mạng khi luyện camera lần đầu.
