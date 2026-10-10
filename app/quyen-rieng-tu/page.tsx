"use client";

import { Camera, HardDrive, Globe, ShieldCheck } from "lucide-react";
import { TopBar } from "@/components/ui";

const SECTIONS = [
  {
    icon: Camera,
    title: "Camera",
    body: "App chỉ bật camera khi bạn bấm luyện. Hình ảnh được xử lý ngay trên máy để tìm 21 điểm của mỗi bàn tay. Video và hình ảnh không được lưu và không được gửi đi đâu.",
  },
  {
    icon: HardDrive,
    title: "Dữ liệu học tập",
    body: "Tên hiển thị, vùng ký hiệu, mục tiêu, tiến độ và từ đã lưu chỉ nằm trong bộ nhớ của trình duyệt hoặc app trên máy bạn. App không có tài khoản và không có máy chủ riêng. Xoá trong Cài đặt → Đặt lại tiến độ, hoặc gỡ app.",
  },
  {
    icon: Globe,
    title: "Kết nối mạng",
    body: "Bộ nhận diện bàn tay và 100 video mẫu nằm sẵn trong app, không cần mạng. Chỉ video của từ điển Bộ GD&ĐT được phát qua mạng từ qipedc.moet.gov.vn; máy chủ đó thấy địa chỉ IP của bạn như khi mở một trang web.",
  },
  {
    icon: ShieldCheck,
    title: "Không theo dõi",
    body: "App không dùng quảng cáo, không dùng công cụ đo lường hay ghi lại phiên sử dụng. Nếu sau này thêm, app sẽ hỏi bạn trước.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="app" style={{ gap: 16 }}>
      <TopBar title="Camera & quyền riêng tư" />
      {SECTIONS.map(({ icon: I, title, body }) => (
        <section key={title} className="card card--row" style={{ alignItems: "flex-start" }}>
          <span className="icon-circle" style={{ width: 44, height: 44, background: "var(--acc-subtle)", color: "var(--acc)" }}>
            <I size={22} aria-hidden />
          </span>
          <span className="col" style={{ gap: 4 }}>
            <h2 className="sub">{title}</h2>
            <p className="bm" style={{ margin: 0, color: "var(--txt)" }}>
              {body}
            </p>
          </span>
        </section>
      ))}
      <section className="card" style={{ gap: 4 }}>
        <h2 className="sub">Liên hệ</h2>
        <p className="bm" style={{ margin: 0, color: "var(--txt)" }}>
          Câu hỏi về dữ liệu hoặc muốn báo lỗi, gửi thư tới:
        </p>
        <a href="mailto:quanggooner1996@gmail.com" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, color: "var(--acc)", fontWeight: 700, textDecoration: "underline", width: "fit-content" }}>
          quanggooner1996@gmail.com
        </a>
      </section>
      <p className="sm" style={{ margin: 0 }}>
        Mã nguồn: github.com/quang507/VSL · Cập nhật 10/10/2026
      </p>
    </main>
  );
}
