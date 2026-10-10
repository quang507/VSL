import { asset } from "@/lib/base";
import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import "./globals.css";
import PWARegister from "@/components/PWARegister";

const baloo = Baloo_2({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700"],
  variable: "--font-baloo",
  display: "swap",
});
const nunito = Nunito({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-nunito",
  display: "swap",
});

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
    <html lang="vi" className={`${baloo.variable} ${nunito.variable}`}>
      <body>
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
