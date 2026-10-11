# Ghi chú gửi người duyệt (App Review Notes)

Dán phần tiếng Anh bên dưới vào ô **App Review Information → Notes** trong App Store Connect.
Phần tiếng Việt chỉ để nhóm hiểu, không gửi đi.

Trước khi nộp, thay 3 chỗ trong ngoặc vuông `[...]`.

---

## Bản gửi Apple (tiếng Anh)

```text
VSLV teaches Vietnamese Sign Language (VSL) to Deaf and hard-of-hearing people and their families.

NO ACCOUNT NEEDED
There is no sign-in, no purchase and no subscription. All features are available right after the 4-step setup.

HOW TO TEST THE MAIN FEATURE (about 2 minutes)
1. Open the app, tap "Bắt đầu" and finish setup (name is optional).
2. On the home tab "Lộ trình", tap "Học tiếp".
3. Step 1 shows a real signer video. Step 2 ("Tập & chấm") opens the front camera.
4. Stand about 1 m from the phone so your head, both hands and waist are visible, then copy
   the sign shown in the small sample video in the corner. There is no button to press: the app
   scores the sign automatically when your hands stop moving or go down.
   (A button with a 3-2-1 countdown is available in Settings → "Tự chấm khi ký" off.)
5. The app shows the result with text, a green or red screen-edge flash and a haptic pattern
   (one tap = correct, two taps = not recognised). Sound is optional because the audience is Deaf.

A 30-second demo video of a signer completing these steps: [LINK TO DEMO VIDEO]

ABOUT RECOGNITION ACCURACY
Hand tracking and the sign classifier run fully on the device. Recognition is not perfect:
with a signer the model has never seen it recognises about two out of three signs, and it depends
on lighting and distance. If your sign is not recognised the app says "Chưa đúng" and shows what
it detected. This is expected behaviour, not a crash. The feature labelled "Thử nghiệm"
(experimental) is the sign-to-text translator under "Luyện tập → Dịch ký hiệu".

CAMERA AND PRIVACY
The camera is used only on practice screens. Frames are processed on the device to find 21 hand
landmarks; no image or video is stored or uploaded. The app has no server, no analytics, no ads
and no tracking. Progress is saved only in the app's local storage.
Privacy policy: https://quang507.github.io/VSL/quyen-rieng-tu/

WORKS OFFLINE
Lessons, the 100 sample videos, hand tracking and scoring are bundled in the app and work in
Airplane Mode. Only the extended dictionary tab ("Từ điển → Bộ GD&ĐT") streams videos and shows
a clear offline message when there is no connection.

THIRD-PARTY CONTENT
- Sample videos for the 100 scored signs: ViSignLanguage-Video dataset (PTIT AI Challenge), CC-BY-4.0, credited in the app.
- Phrase data: Look & Tell project, Apache-2.0, credited in the app.
- Extended dictionary (3,315 words): videos are streamed from the Vietnamese Ministry of Education
  and Training sign language dictionary (qipedc.moet.gov.vn) with their permission.
  [ATTACH PERMISSION LETTER OR EMAIL IN APP STORE CONNECT]
- Fonts Baloo 2 and Nunito: SIL Open Font License 1.1.
- Welcome-screen illustration (presenter and mascot): created by our team with an AI image tool.
  It does not depict a real person.

NATIVE FEATURES
Camera (AVFoundation via WKWebView getUserMedia), haptic feedback (UINotificationFeedbackGenerator),
iPhone and iPad layouts, safe-area support, VoiceOver labels on all controls.

CONTACT
[YOUR NAME], quanggooner1996@gmail.com
```

---

## Giải thích cho nhóm (tiếng Việt)

| Đoạn | Viết để tránh lỗi nào |
|---|---|
| Không cần tài khoản | Người duyệt không phải xin tài khoản thử. Thiếu thông tin đăng nhập là lý do bị trả về phổ biến |
| Cách thử 5 bước | Người duyệt không biết ký hiệu. Không có hướng dẫn thì họ sẽ nghĩ app không chạy (mục 2.1) |
| Video demo | Chứng minh tính năng chạy thật khi người duyệt ký không ra |
| Nói thẳng độ chính xác | Để kết quả "Chưa đúng" không bị coi là lỗi. Không được ghi con số đẹp hơn thực tế |
| Camera và quyền riêng tư | Khớp với câu xin quyền camera và phần khai báo "không thu thập dữ liệu" (mục 5.1) |
| Chạy offline | Trả lời trước nghi ngờ "web bọc lại" (mục 4.2). Đã có test tự động N9 kiểm việc này |
| Nội dung bên thứ ba | Mục 5.2. **Phải có giấy cho phép của QIPEDC trước khi nộp** |
| Tính năng gốc | Cho thấy app dùng khả năng của máy, không chỉ hiện trang web |

## Việc phải làm trước khi dán

1. **Quay video demo 30 giây** rồi đưa lên một link xem được không cần đăng nhập (YouTube không công khai là đủ). Thay `[LINK TO DEMO VIDEO]`.
2. **Xin văn bản cho phép của QIPEDC**, đính kèm ở mục App Review Information → Attachment. Nếu chưa có, tắt tab "Bộ GD&ĐT" trong bản nộp và xoá đoạn tương ứng ở trên.
3. **Điền tên** vào `[YOUR NAME]`. Số điện thoại liên hệ điền ở ô riêng của App Store Connect.
4. **Ảnh màn chào (cô gái và mascot) do nhóm tạo bằng AI**, không phải ảnh của bên thứ ba, nên không vướng mục 5.2. Việc còn lại: ghi tên công cụ đã dùng vào bảng dưới và kiểm điều khoản của công cụ đó có cho dùng thương mại không (một số gói miễn phí không cho).

## Nguồn gốc hình ảnh trong app

| Hình | Nguồn | Giấy tờ |
|---|---|---|
| Ảnh cô gái vẫy tay, mascot, chữ "Xin chào!" ở màn chào | Nhóm tạo bằng AI. Công cụ: [ĐIỀN TÊN] | Điều khoản dùng thương mại của công cụ |
| Mascot ở Luyện tập, Hồ sơ; ảnh trang trí (mây, sóng, lấp lánh) | Lấy từ file Figma của nhóm | Do nhóm tạo |
| 100 video mẫu và ảnh thu nhỏ người ký | ViSignLanguage-Video, CC-BY-4.0 | Ghi nguồn trong app (đã có) |
| Video từ điển 3.315 từ | Bộ GD&ĐT, phát từ qipedc.moet.gov.vn | **Cần văn bản cho phép** |
| Logo VSLV, icon | Do nhóm tạo | Không cần |
