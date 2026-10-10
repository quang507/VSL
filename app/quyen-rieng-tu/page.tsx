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
    body: "Video của từ điển Bộ GD&ĐT được phát từ qipedc.moet.gov.vn. Bộ nhận diện bàn tay (MediaPipe) được tải từ jsDelivr và Google lần đầu mở camera. Các máy chủ này thấy địa chỉ IP của bạn như khi mở một trang web.",
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
      <p className="sm" style={{ margin: 0 }}>
        Mã nguồn: github.com/quang507/VSL
      </p>
    </main>
  );
}
