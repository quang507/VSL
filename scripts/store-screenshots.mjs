// Chụp ảnh màn hình cho App Store / Google Play từ bản build tĩnh (out/).
// iPhone 6,9": 1290×2796 (430×932 @3x) · iPad 13": 2064×2752 (1032×1376 @2x).
// Chạy: npm run build && npm run store:screenshots
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3190;
const base = `http://localhost:${PORT}`;
const DEVICES = [
  { dir: "iphone", viewport: { width: 430, height: 932 }, scale: 3 },
  { dir: "ipad", viewport: { width: 1032, height: 1376 }, scale: 2 },
];
const SHOTS = [
  ["1-lo-trinh", "/"],
  ["2-xem-mau", "/practice/?word=C%E1%BA%A3m%20%C6%A1n&lesson=chao-hoi"],
  ["3-tu-dien", "/tu-dien/"],
  ["4-chi-tiet-tu", "/tu-dien/tu/?w=%C4%91%E1%BB%8Ba%20ch%E1%BB%89"],
  ["5-luyen-tap", "/luyen-tap/"],
  ["6-ho-so", "/ho-so/"],
];

// Dữ liệu mẫu: người dùng "Minh" đã học vài ngày
function seed() {
  const now = Date.now();
  const key = (d) => {
    const t = new Date(now - d * 864e5);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  };
  const w = (attempts, correct, box, dueIn, lastAgo) => ({ attempts, correct, box, due: now + dueIn, last: now - lastAgo });
  localStorage.setItem("vsl-profile-v1", JSON.stringify({ name: "Minh", region: "hn", onboarded: true, vibrate: true, flash: true, slowVideo: false }));
  localStorage.setItem(
    "vsl-progress-v1",
    JSON.stringify({
      words: { Chào: w(4, 4, 3, -1000, 3600e3), "Cảm ơn": w(5, 4, 2, 5e6, 600e3), "Xin lỗi": w(4, 3, 2, -500, 7200e3), "Xin phép": w(3, 2, 1, 4e6, 9000e3), Tôi: w(2, 2, 2, 8e6, 86400e3), "Bạn thân": w(3, 1, 0, -200, 90000e3) },
      streak: 3, bestStreak: 7, score: 160,
      days: { [key(0)]: 4, [key(1)]: 6, [key(2)]: 5, [key(3)]: 2, [key(4)]: 5, [key(5)]: 3, [key(6)]: 5 },
      dailyGoal: 5, soundOn: false,
    })
  );
  localStorage.setItem("vsl-saved-v1", JSON.stringify(["Cảm ơn", "Chào", "Xin lỗi"]));
}

const server = spawn("npx", ["serve", join(root, "out"), "-l", String(PORT), "--no-clipboard"], { shell: true, stdio: "ignore" });
const waitUp = async () => {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(base)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Không khởi động được máy chủ tĩnh");
};

try {
  await waitUp();
  const browser = await chromium.launch();
  for (const d of DEVICES) {
    const out = join(root, "docs", "store", "screenshots", d.dir);
    mkdirSync(out, { recursive: true });
    const ctx = await browser.newContext({ viewport: d.viewport, deviceScaleFactor: d.scale, locale: "vi-VN", isMobile: d.dir === "iphone", hasTouch: true });
    await ctx.addInitScript(seed);
    const page = await ctx.newPage();
    for (const [name, path] of SHOTS) {
      await page.goto(base + path);
      await page.waitForLoadState("networkidle").catch(() => {});
      // chờ video hiện khung hình thật (không chụp khung đen)
      await page.evaluate(async () => {
        const vids = [...document.querySelectorAll("video")].filter((v) => v.getBoundingClientRect().top < innerHeight);
        await Promise.all(vids.map((v) => (v.readyState >= 3 ? 0 : new Promise((r) => { v.addEventListener("loadeddata", r, { once: true }); setTimeout(r, 8000); }))));
      });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: join(out, `${name}.jpg`), type: "jpeg", quality: 92 });
      console.log(d.dir, name);
    }
    await ctx.close();
  }
  await browser.close();
} finally {
  server.kill();
}
