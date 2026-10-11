# VSLV · Kế hoạch kiểm thử và kiểm định UX

Bản 1.0 · 10/10/2026 · nhánh `redesign-vslv`

VSLV là app học ngôn ngữ ký hiệu Việt Nam cho người Điếc và người học ký hiệu. Người dùng xem video mẫu, ký trước camera, app chấm ngay trên máy. Tài liệu này nói rõ kiểm cái gì, bằng công cụ nào, ai làm, và thế nào là đạt.

## 1. Mục tiêu và phạm vi

| Câu hỏi cần trả lời | Tầng kiểm định |
|---|---|
| App có chạy đúng trên iPhone, Android, máy tính không? | 1 · Tự động |
| Có đạt chuẩn tiếp cận WCAG 2.1 AA không? | 1 · Tự động |
| Người dùng thật bị kẹt ở đâu khi dùng hằng ngày? | 2 · Đo hành vi |
| Người Điếc có tự hoàn thành được việc chính không? | 3 · Thử với người dùng |
| Camera chấm có đúng với người lạ không? | 3 · Thử với người dùng |
| Thiết kế có vi phạm nguyên tắc khả dụng nào không? | 4 · Đánh giá chuyên gia |

Trong phạm vi: 16 màn của bản web tĩnh (`out/`), cũng là bản đóng gói Capacitor.
Ngoài phạm vi lần này: bản cài Android/iOS thật (chưa build), tải nặng, bảo mật máy chủ (app không có máy chủ).

## 2. Người dùng và rủi ro chính

- **Người Điếc, khiếm thính**: không dựa vào âm thanh. Nhiều người đọc tiếng Việt như ngôn ngữ thứ hai, nên chữ phải ngắn và có hình.
- **Người nghe học ký hiệu** (người thân, giáo viên, sinh viên).

| Rủi ro | Hậu quả | Cách kiểm |
|---|---|---|
| App báo "Đúng" khi ký sai | Dạy sai người học | Tầng 3, mục 6.4 |
| App chê khi ký đúng | Nản, bỏ app | Tầng 3, mục 6.4 |
| Thông tin chỉ truyền bằng âm thanh hoặc chỉ bằng màu | Người Điếc, người mù màu không nhận được | Tầng 1 (axe) và tầng 4 |
| Không mở được camera | Mất chức năng chính | Tầng 1 (N8), tầng 3 |
| Chữ nhiều, khó hiểu | Người đọc kém bị kẹt | Tầng 3, tầng 4 |

## 3. Bốn tầng kiểm định

| Tầng | Công cụ | Ai làm | Khi nào | Tình trạng |
|---|---|---|---|---|
| 1 · Tự động và kỹ thuật | Playwright, axe-core, Lighthouse | Máy, mỗi lần đổi code | Trước mỗi lần commit lớn | **Đã chạy, đạt** |
| 2 · Đo hành vi thực tế | Microsoft Clarity hoặc PostHog | Nhóm, sau khi phát hành | Liên tục | Chưa bật, xem mục 5 |
| 3 · Thử với người dùng thật | Buổi thử trực tiếp, Maze, Lyssna | Nhóm 3 người + phiên dịch | Trước khi lên cửa hàng | Có kịch bản, chưa làm |
| 4 · Đánh giá heuristic | 10 nguyên tắc Nielsen + 4 tiêu chí cho người Điếc | Người thiết kế | Sau mỗi lần đổi giao diện | **Đã làm, xem mục 7** |

## 4. Tầng 1 · Kiểm thử tự động

### Cách chạy

```bash
npm run build
```

```bash
npm run test:e2e
```

Báo cáo HTML nằm ở `tests/report/index.html`. Cấu hình ở `playwright.config.ts`, kịch bản ở `tests/e2e/`.

Chạy trên ba môi trường: **iPhone 13 (WebKit, nhân của Safari)**, **Pixel 7 (Chromium, có camera giả)**, **máy tính 1366×860**.

### Kịch bản người dùng (`flows.spec.ts`)

| Mã | Kịch bản | Điều kiện đạt |
|---|---|---|
| N1 | Người mới: đặt tên, chọn vùng, chọn mục tiêu, vào học | Về Lộ trình, thấy đúng tên và mục tiêu đã chọn |
| N2 | Bấm "Học tiếp" ở Lộ trình | Mở đúng từ đang học; bài bị khoá không bấm được |
| N3 | Tra "benh vien" và "tac dong" không dấu | Ra kết quả ở cả hai nguồn; từ hai nghĩa có hai video khác nhau |
| N4 | Lưu một từ | Từ hiện ở "Đã lưu gần đây" và ô "Đã lưu" của Hồ sơ |
| N5 | Xem từ đến hạn ôn | Con số giống nhau ở Luyện tập và Từ điển |
| N6 | Mở Câu giao tiếp | Đúng 59 câu, câu chưa rõ nghĩa không hiện |
| N7 | Đi qua 4 tab, bấm nút tìm | Đúng trang; ô tìm được focus |
| N8 | Mở luyện với camera (camera giả) | Thấy khung camera và gợi ý "Đưa tay vào khung" |
| N9 | Chặn mọi máy chủ ngoài rồi học và mở luyện camera | Video mẫu chạy, app vào trạng thái tự chấm (không có nút), có video mẫu ở góc khung, không có yêu cầu nào ra ngoài (App Store mục 4.2) |
| N10 | Tắt "Tự chấm khi ký" trong Cài đặt rồi luyện | Có nút "Bắt đầu ký", đếm ngược 3-2-1, báo "Không thấy tay" với camera giả |
| R | Bề rộng 320, 390, 768, 1280px | Không trang nào cuộn ngang |

### Tiếp cận (`a11y.spec.ts`)

- axe-core với bộ luật WCAG 2.0/2.1 mức A và AA, trên 16 trang.
- Mọi phần tử bấm được phải rộng và cao từ 44px (Apple HIG, WCAG 2.5.5).
- Đạt khi: không có vi phạm mức *serious* hoặc *critical*, không có vùng chạm nhỏ hơn 44px.

### Lighthouse (di động, mạng 4G chậm giả lập)

```bash
npx lighthouse http://localhost:3001/tu-dien/ --form-factor=mobile --only-categories=performance,accessibility,best-practices
```

| Chỉ số | Ngưỡng đạt |
|---|---|
| Tiếp cận | 100 |
| Thực hành tốt | từ 95 |
| Hiệu năng | từ 90 |
| LCP (thời gian hiện nội dung chính) | dưới 3 giây |
| CLS (độ giật bố cục) | dưới 0,1 |

### Độ chính xác nhận diện (`training/eval/`)

Luôn đo bằng `retrain_clean.py`: chia theo buổi quay để người ký trong phần kiểm tra không có trong phần train. **Không dùng cách chia ngẫu nhiên**, vì dữ liệu có bản sao và cho ra số ảo (88% thay vì 64%).

| Chỉ số (người ký chưa gặp) | Hiện tại | Ngưỡng để phát hành rộng |
|---|---|---|
| Đoán đúng từ | 64% | từ 80% |
| Đúng trong 3 từ đầu | 80% | từ 92% |
| App báo "Đúng" khi ký đúng | 57% | từ 75% |

Hiện tại chưa đạt ngưỡng phát hành rộng. Cách nâng: thu thêm dữ liệu từ nhiều người ký (xem mục 6.4).

### Chế độ tự chấm (không bấm nút)

Hai lớp kiểm tra, vì camera giả mặc định của Playwright không có bàn tay nào:

1. `tests/e2e/segmenter.unit.ts` (chạy cùng `npm run test:e2e`, project `logic`): bộ tách động tác với chuyển động giả lập ở 5, 12, 30, 60 và 120 khung hình/giây. Kiểm tra: ký xong thì chấm đúng một lần, tay đặt yên không bị chấm, để tay trong khung lâu rồi mới ký không bị cắt giữa chừng, ký hiệu chỉ cử động ngón vẫn được chấm.
2. `npm run eval:auto`: phát video người ký thật vào camera giả (`scripts/make_y4m.py`, cần Python có `opencv-python`), mở màn luyện và không bấm gì, rồi đếm số lần app chấm và số lần đúng. Chạy tay trước mỗi bản phát hành, không chạy trên CI.

| Lần đo 11/10/2026 (12 từ, 2 tình huống) | Trước khi sửa | Sau khi sửa |
|---|---|---|
| Tỉ lệ lần chấm đúng, máy thường (~22 khung hình/giây) | 54% (42/78) | 64% (49/77) |
| Số từ có ít nhất một lần đúng (ký ngay / chờ lâu) | 9 và 8 trên 12 | 10 và 9 trên 12 |
| Máy rất yếu (~2,5 khung hình/giây) | không chấm lần nào | chấm được, 71% đúng (22/31, 4 từ) |

Video mẫu nằm trong tập train, nên đây là kiểm tra khâu tách động tác chứ không phải độ chính xác với người lạ. Mức trần khi đưa nguyên clip vào model qua bộ dò tay của app là 77/100 từ, và bộ tách động tác đạt 76 đến 79/100 trong mô phỏng. Phần còn lại chưa kiểm được bằng máy: người thật ký trước camera thật (mục 6.4).

## 5. Tầng 2 · Đo hành vi thực tế (chưa bật)

App hiện **không** gắn công cụ đo nào, và trang Quyền riêng tư đang cam kết như vậy. Muốn bật phải làm đủ ba việc trước:

1. Hỏi đồng ý ở lần mở đầu, mặc định là không.
2. Che toàn bộ vùng camera khỏi bản ghi phiên (`data-clarity-mask` hoặc `ph-no-capture`).
3. Sửa trang Quyền riêng tư và phần khai báo dữ liệu trên App Store, Google Play.

| Công cụ | Dùng để | Ghi chú |
|---|---|---|
| Microsoft Clarity | Xem lại phiên, bản đồ nhiệt, bấm liên tục vì bực (rage click), bấm vào chỗ không bấm được (dead click) | Miễn phí. Chỉ chạy được trên bản web, không chạy trong app đóng gói nếu thiếu mạng |
| PostHog | Phễu chuyển đổi và giữ chân | Tự gửi sự kiện, kiểm soát được dữ liệu |

Khuyến nghị: bật Clarity trên bản web thử nghiệm với nhóm người thử đã đồng ý, chưa bật trong bản lên cửa hàng.

**Phễu cần đo**

| Bước | Sự kiện | Mục tiêu |
|---|---|---|
| 1 | `onboarding_done` | từ 85% người mở app |
| 2 | `practice_opened` (mở bài đầu tiên) | từ 70% của bước 1 |
| 3 | `camera_granted` | từ 80% của bước 2 |
| 4 | `sign_correct` lần đầu | từ 60% của bước 3 |
| 5 | Quay lại ngày hôm sau | từ 30% của bước 1 |

Dấu hiệu cần xem lại trong bản ghi: bấm liên tục vào bài bị khoá, bấm "Thử lại" quá 3 lần cho một từ, rời đi ở màn xin quyền camera.

## 6. Tầng 3 · Thử với người dùng thật

### 6.1 Người tham gia

- 5 đến 8 người. Ít nhất 4 người Điếc hoặc khiếm thính, 2 người nghe đang học ký hiệu.
- Trải đều: quen và chưa quen app học ngoại ngữ; thuận tay trái ít nhất 1 người.
- Có **phiên dịch ngôn ngữ ký hiệu**. Người điều phối không giải thích cách dùng app.
- Xin đồng ý bằng văn bản và bằng ký hiệu trước khi quay màn hình. Không quay mặt nếu người tham gia không muốn.

### 6.2 Thiết bị

Điện thoại của chính người tham gia (ghi lại đời máy), mở link bản web. Phòng đủ sáng, có chỗ dựng máy cách người khoảng 1 mét.

### 6.3 Nhiệm vụ

Sau mỗi nhiệm vụ hỏi một câu: "Việc này dễ hay khó?" theo thang 1 (rất khó) đến 7 (rất dễ).

| Mã | Nhiệm vụ (đọc và ký cho người tham gia) | Hoàn thành khi | Thời gian mong đợi |
|---|---|---|---|
| T0 | *Thử 5 giây:* cho xem màn Lộ trình 5 giây rồi tắt. Hỏi: "App này để làm gì? Bạn sẽ bấm vào đâu trước?" | Nói được "học ký hiệu" và chỉ nút "Học tiếp" | 5 giây |
| T1 | "Bạn mới cài app. Hãy thiết lập để bắt đầu học." | Tới màn Lộ trình | dưới 90 giây |
| T2 | "Hãy học ký hiệu đầu tiên và để app chấm cho bạn." | App hiện kết quả đúng hoặc sai | dưới 3 phút |
| T3 | "App chê bạn ký sai. Bạn làm gì tiếp?" | Xem lại mẫu hoặc thử lại, không thoát | dưới 60 giây |
| T4 | "Tìm ký hiệu của từ 'địa chỉ' và xem video." | Mở được trang từ, video chạy | dưới 60 giây |
| T5 | "Bạn sống ở Hà Nội. Hãy xem cách ký của miền Bắc cho từ đó." | Chọn đúng "Miền Bắc" | dưới 30 giây |
| T6 | "Lưu từ này để học sau, rồi tìm lại nó." | Mở lại được từ đã lưu | dưới 60 giây |
| T7 | "Hôm nay có từ nào cần ôn không? Hãy ôn một từ." | Vào được bài ôn | dưới 60 giây |
| T8 | "Tắt rung, chỉ để nháy viền màn hình." | Đổi đúng công tắc | dưới 45 giây |

Nếu không có người thật ngay: dựng T0 trên **Lyssna** (thử 5 giây) và T4 đến T6 trên **Maze** bằng prototype Figma. Hai công cụ này đo sẵn tỉ lệ hoàn thành, thời gian và tỉ lệ bấm nhầm.

### 6.4 Kiểm định camera với người thật

Đây là phần quan trọng nhất, vì số đo trong phòng chỉ là 64%.

- Mỗi người ký **10 từ, mỗi từ 3 lần**. Chọn 10 từ từ chặng 1 và 2.
- Phiên dịch chấm tay: lần ký đó đúng hay sai. Ghi lại app báo gì.
- Thêm 5 lần **cố ý ký sai** (ký một từ khác) để đo báo nhầm.

| Chỉ số | Cách tính | Đạt khi |
|---|---|---|
| Nhận đúng | Số lần app báo "Đúng" trên số lần ký đúng thật | từ 75% |
| Báo nhầm | Số lần app báo "Đúng" trên số lần cố ý ký sai | dưới 10% |
| Mở được camera | Số người mở được ngay lần đầu | 100% |

Nếu người tham gia đồng ý, lưu lại các điểm bàn tay (không lưu video) để bổ sung dữ liệu train.

### 6.5 Chỉ số và ngưỡng

| Chỉ số | Ngưỡng đạt |
|---|---|
| Tỉ lệ hoàn thành mỗi nhiệm vụ | từ 80% người tham gia, không cần trợ giúp |
| Độ dễ sau nhiệm vụ (1 đến 7) | trung bình từ 5,5 |
| Điểm SUS cuối buổi | từ 72 (mức "tốt") |
| Lỗi nghiêm trọng (không hoàn thành được) | 0 ở T1, T2, T4 |

**Bảng hỏi SUS** (1 = hoàn toàn không đồng ý, 5 = hoàn toàn đồng ý; phiên dịch ký từng câu):

1. Tôi muốn dùng app này thường xuyên.
2. Tôi thấy app phức tạp hơn mức cần thiết.
3. Tôi thấy app dễ dùng.
4. Tôi cần người khác giúp mới dùng được app.
5. Các phần trong app liên kết với nhau hợp lý.
6. Tôi thấy app có nhiều chỗ không thống nhất.
7. Tôi nghĩ đa số mọi người sẽ học cách dùng app rất nhanh.
8. Tôi thấy app rườm rà, khó dùng.
9. Tôi tự tin khi dùng app.
10. Tôi phải học nhiều thứ trước khi dùng được app.

Cách tính: câu lẻ lấy điểm trừ 1, câu chẵn lấy 5 trừ điểm, cộng lại rồi nhân 2,5.

### 6.6 Mẫu ghi chép cho mỗi người

| Nhiệm vụ | Hoàn thành (có / có trợ giúp / không) | Thời gian | Số lần bấm nhầm | Độ dễ 1–7 | Quan sát |
|---|---|---|---|---|---|
| T1 | | | | | |

## 7. Tầng 4 · Đánh giá heuristic

Mức độ: 0 không phải lỗi · 1 thẩm mỹ · 2 nhỏ · 3 lớn · 4 nghiêm trọng.

### Kết quả lần đánh giá 10/10/2026

| # | Nguyên tắc | Phát hiện | Mức | Tình trạng |
|---|---|---|---|---|
| 1 | Hiển thị trạng thái hệ thống | Video từ điển Bộ GD&ĐT tải mà không báo gì, chỉ thấy khung đen | 2 | **Đã sửa**: hiện "Đang tải video…" |
| 1 | | Gợi ý camera theo thời gian thực (đưa tay vào khung, lùi ra, tiến gần) | 0 | Tốt |
| 2 | Khớp với thế giới thật | "Đã thạo" trong khi chỉ cần ký đúng 1 lần | 1 | **Đã sửa**: "Đã thuộc" |
| 2 | | Từ "XP", "Combo" là thuật ngữ game, người lớn tuổi có thể không hiểu | 1 | Hỏi trong buổi thử |
| 3 | Kiểm soát và tự do | Bài trong chặng bị khoá theo thứ tự (theo Figma) | 2 | Giữ. Vẫn học tự do qua Từ điển. Đo ở tầng 2 xem có bấm bực vào bài khoá không |
| 4 | Nhất quán | Chuỗi ngày hiện 3 kiểu khác nhau ở 3 màn (theo Figma) | 1 | Ghi nhận, sửa ở Figma trước |
| 5 | Ngăn lỗi | Đặt lại tiến độ có hộp xác nhận; xin quyền camera có giải thích trước | 0 | Tốt |
| 6 | Nhận ra thay vì nhớ | Mỗi hàng có ảnh người ký; có "Từ đã học gần đây" | 0 | Tốt |
| 7 | Linh hoạt | Nút tìm nổi ở mọi tab; video có chế độ chậm | 0 | Tốt |
| 8 | Tối giản | Màn Luyện tập có 7 khối, hơi dày | 1 | Hỏi trong buổi thử |
| 9 | Giúp gỡ lỗi | Lỗi camera chỉ có chữ, không có nút làm lại | 2 | **Đã sửa**: thêm nút "Thử lại" và hướng dẫn |
| 9 | | App không nói rằng AI có thể nhận nhầm | 3 | **Đã sửa một phần**: ghi chú dưới kết quả sai. Gốc rễ là độ chính xác 64% |
| 10 | Trợ giúp | Không có trang hướng dẫn hay câu hỏi thường gặp | 2 | Chưa làm |

### Tiêu chí riêng cho người Điếc

| # | Tiêu chí | Phát hiện | Mức | Tình trạng |
|---|---|---|---|---|
| D1 | Không có thông tin chỉ truyền bằng âm thanh | Âm thanh là tuỳ chọn, mọi phản hồi đều có hình | 0 | Tốt |
| D2 | Phản hồi không chỉ dựa vào màu | Đúng/sai có chữ, biểu tượng, viền nháy và rung | 0 | Tốt |
| D3 | Hướng dẫn bằng ký hiệu, không chỉ bằng chữ | Onboarding, mẹo camera, trang quyền riêng tư đều là chữ tiếng Việt | 3 | Chưa làm. Cần quay video ký hiệu cho các hướng dẫn chính |
| D4 | Giao tiếp với người nghe | Chế độ Dịch có đọc to và phóng to chữ | 0 | Tốt |

## 8. Ma trận thiết bị

| Thiết bị | Trình duyệt hoặc bản cài | Cách kiểm |
|---|---|---|
| iPhone (iOS 16 trở lên) | Safari | Tự động (WebKit) + tay với camera thật |
| Android (10 trở lên) | Chrome | Tự động (Chromium) + tay với camera thật |
| iPad | Safari | Tự động ở 768px + tay |
| Máy tính | Chrome, Edge | Tự động ở 1280px + webcam |
| Bản cài Android, iOS | Capacitor | Chưa build. Kiểm tay sau khi build |

Điều kiện camera cần thử bằng tay: đủ sáng, thiếu sáng, ngược sáng, cách 0,5 mét, cách 1,5 mét, thuận tay trái, áo cùng màu da.

## 9. Điều kiện vào, ra và phân loại lỗi

- **Vào**: `npm run build` thành công, không lỗi kiểu dữ liệu.
- **Ra để lên cửa hàng**: tầng 1 đạt hết; tầng 3 đạt ngưỡng ở mục 6.5; không còn lỗi mức 3 và 4 ở tầng 4; nhận diện đạt ngưỡng ở mục 6.4.

| Mức lỗi | Ví dụ | Xử lý |
|---|---|---|
| Chặn | Không mở được camera, app trắng màn | Sửa ngay, không phát hành |
| Lớn | Báo đúng khi ký sai, mất tiến độ | Sửa trước khi phát hành |
| Nhỏ | Chữ tràn, nút hơi nhỏ | Xếp lịch |
| Thẩm mỹ | Lệch vài px so với Figma | Gom lại sửa một lần |

## 10. Kết quả lần chạy 10/10/2026

| Hạng mục | Kết quả |
|---|---|
| Kịch bản N1–N7 trên iPhone, Android, máy tính | 21/21 đạt |
| N8 camera giả trên Android | Đạt |
| N9 chạy không cần mạng ngoài | Đạt |
| Không cuộn ngang ở 320, 390, 768, 1280px | Đạt |
| axe-core, 16 trang × 2 môi trường | 32/32 đạt, 0 vi phạm nghiêm trọng |
| Tổng số test tự động | 60/60 đạt |
| Vùng chạm từ 44px | Đạt |
| Lighthouse màn chào | Hiệu năng 100 · Tiếp cận 100 · Thực hành tốt 100 · LCP 1,4 giây |
| Lighthouse Từ điển | Hiệu năng 93 · Tiếp cận 100 · Thực hành tốt 100 · CLS 0,022 |
| Nhận diện, người ký chưa gặp | 64% đúng từ, 80% trong 3 từ đầu. **Chưa đạt** ngưỡng phát hành rộng |

**Lỗi tìm thấy và đã sửa trong lần này**

| Lỗi | Tìm bằng | Sửa |
|---|---|---|
| Thanh tiến độ không có tên cho trình đọc màn hình (16 trang) | axe-core | Thêm nhãn |
| 9 loại nút nhỏ hơn 44px (tốc độ video, công tắc, pill chuỗi ngày, "Học tiếp", ô tìm) | Kiểm vùng chạm | Tăng lên 44px |
| Màu nút Figma #4a8cf5 với chữ trắng chỉ đạt 3,3:1 | Tính tay | Dùng #2f6fde, đạt 4,7:1 |
| Trang Từ điển giật bố cục, CLS 0,72 | Lighthouse | Thêm khung giữ chỗ, còn 0,022 |
| Màn chào tải chậm, LCP 5,2 giây | Lighthouse | Ảnh PNG sang WebP (613 KB còn 91 KB), còn 1,4 giây |
| Nhãn thẻ "Từ của ngày" không khớp chữ hiển thị | Lighthouse | Bỏ nhãn thừa |
| Lỗi camera không có nút thử lại | Heuristic #9 | Thêm nút và hướng dẫn |

## 11. Chuẩn bị lên cửa hàng

Rà theo các lý do Apple hay từ chối. Chi tiết ở `docs/store/`.

| Nguy cơ | Mục của Apple | Tình trạng |
|---|---|---|
| Bị coi là web bọc lại: bộ nhận diện tay tải từ CDN, mất mạng là hỏng | 4.2 | **Đã sửa**: nhúng MediaPipe và model vào app, có test N9 |
| Rung không chạy trên iPhone (trình duyệt iOS không có API rung) | 2.1 | **Đã sửa**: dùng Haptics gốc của Capacitor. Cần thử trên máy thật |
| Icon và màn khởi động mặc định | 2.3 | **Đã sửa**: `scripts/make_icons.py` |
| Thiếu khai báo quyền riêng tư và mã hoá | 5.1 | **Đã sửa**: `PrivacyInfo.xcprivacy`, `ITSAppUsesNonExemptEncryption` |
| Người duyệt không biết ký hiệu, tưởng app không chạy | 2.1 | Có bản nháp ghi chú. **Còn thiếu video demo** |
| Video từ điển Bộ GD&ĐT chưa có giấy tờ bản quyền | 5.2 | **Chưa xong**: cần văn bản của QIPEDC |
| Ảnh màn chào (cô gái, mascot) | 5.2 | Do nhóm tạo bằng AI, không thuộc bên thứ ba. Cần kiểm điều khoản thương mại của công cụ |
| Mô tả nói quá khả năng nhận diện | 2.3 | Bản nháp mô tả đã ghi rõ "có thể nhận nhầm" |

Kiểm tay trên máy thật trước khi nộp (không tự động được):

- [ ] iPhone màn nhỏ và iPhone có tai thỏ: không bị che nội dung
- [ ] iPad: bố cục 2 cột, xoay dọc
- [ ] Chế độ máy bay: học và chấm camera vẫn chạy; tab Bộ GD&ĐT báo mất mạng
- [ ] Từ chối quyền camera, rồi cấp lại trong Cài đặt máy
- [ ] Rung: đúng 1 nhịp, sai 2 nhịp; tắt được trong Cài đặt
- [ ] VoiceOver đi hết luồng: mở app, học tiếp, xem mẫu, quay lại
- [ ] Thuận tay trái, thiếu sáng, cách 0,5 mét và 1,5 mét

## 12. Việc tiếp theo

1. Tổ chức buổi thử với 5 đến 8 người theo mục 6 (cần phiên dịch ký hiệu).
2. Kiểm định camera với người thật theo mục 6.4, dùng kết quả để chọn lại ngưỡng báo "Đúng".
3. Quay video ký hiệu cho onboarding và mẹo camera (D3).
4. Quyết định có bật Clarity cho bản web thử nghiệm không (mục 5).
5. Build bản Android và iOS, chạy lại ma trận thiết bị.
