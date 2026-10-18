import { asset } from "@/lib/base";
import type { Metadata, Viewport } from "next";
import "./fonts.css";
import "./globals.css";
import PWARegister from "@/components/PWARegister";

export const metadata: Metadata = {
  title: "VSLV · Học ngôn ngữ ký hiệu",
  description:
    "Học ngôn ngữ ký hiệu Việt Nam — xem mẫu, bật camera, AI chấm đúng/sai ngay trên máy.",
  manifest: asset("/manifest.json"),
  applicationName: "VSLV",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "VSLV" },
  icons: { icon: asset("/favicon.png"), apple: asset("/icons/apple-touch-icon.png") },
};

export const viewport: Viewport = {
  themeColor: "#f4f8ff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
