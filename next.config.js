/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Xuất web tĩnh vào out/ — dùng cho cả Vercel lẫn app Capacitor (iOS/Android)
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

module.exports = nextConfig;
