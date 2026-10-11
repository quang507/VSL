/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Xuất web tĩnh vào out/ — dùng cho cả Vercel lẫn app Capacitor (iOS/Android)
  output: "export",
  // GitHub Pages phục vụ ở /VSL → đặt NEXT_PUBLIC_BASE_PATH=/VSL lúc build; còn lại để trống
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

module.exports = nextConfig;
