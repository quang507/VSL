import { defineConfig, devices } from "@playwright/test";

/**
 * Kiểm thử tự động (tầng 1 của docs/TEST_PLAN.md).
 * Chạy trên bản build tĩnh (out/) giống hệt bản đóng gói Capacitor.
 *   npm run build && npm run test:e2e
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 6, // nhiều hơn thì các test camera (MediaPipe chạy CPU) bị nghẽn
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "tests/report" }], ["json", { outputFile: "tests/report/results.json" }]],
  use: {
    baseURL: "http://localhost:3100",
    locale: "vi-VN",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npx serve out -l 3100 --no-clipboard",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    // iPhone Safari (WebKit) — nền tảng chính của người dùng
    { name: "iphone-webkit", use: { ...devices["iPhone 13"] } },
    // Android Chrome; camera giả để kiểm tra luồng luyện tập
    {
      name: "android-chromium",
      use: {
        ...devices["Pixel 7"],
        permissions: ["camera"],
        launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
      },
    },
    // Máy tính bảng & máy tính
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 860 } } },
  ],
});
