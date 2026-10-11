// Kiểm tra chế độ TỰ CHẤM bằng video người ký thật, không cần người ngồi trước máy.
// Mỗi từ: đổi video mẫu thành camera giả (scripts/make_y4m.py), mở màn luyện từ đó,
// KHÔNG bấm nút nào sau khi vào camera, rồi đếm app đã chấm mấy lần và đúng mấy lần.
//
//   npm run build && npx serve out -l 3100      (ở một cửa sổ khác)
//   node scripts/eval-auto-capture.mjs [--words "Chào,Cho"] [--secs 14] [--jobs 2] [--mode manual] [--slow]
//
// Video mẫu nằm trong tập train nên model PHẢI nhận ra. Sai ở đây nghĩa là khâu tách động tác sai,
// không phải model yếu.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const BASE = arg("base", "http://localhost:3100");
const SECS = Number(arg("secs", 14));
const JOBS = Number(arg("jobs", 2));
const MODE = arg("mode", "auto"); // auto | manual (manual: bấm nút, để so sánh)
const SLOW = process.argv.includes("--slow"); // giả lập máy rất yếu: bộ dò tay chỉ chạy ~2,5 khung hình/giây
const CACHE = path.resolve(".eval/y4m");
mkdirSync(CACHE, { recursive: true });

const all = readdirSync("public/samples").filter((f) => f.endsWith(".mp4")).map((f) => f.slice(0, -4));
const words = arg("words") ? arg("words").split(",") : all.filter((_, i) => i % 9 === 0);

// Hai tình huống: vào tư thế rồi ký ngay, và để tay trong khung khá lâu rồi mới ký.
const SCENARIOS = [
  { id: "ký ngay", lead: 1, tail: 2 },
  { id: "chờ lâu", lead: 3, tail: 2 },
];

function y4m(word, s) {
  const out = path.join(CACHE, `${word}-${s.lead}-${s.tail}.y4m`);
  if (!existsSync(out)) execFileSync("python", ["scripts/make_y4m.py", `public/samples/${word}.mp4`, out, "--lead", String(s.lead), "--tail", String(s.tail)], { env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
  return out;
}

async function run(word, s) {
  // channel "chromium" = chế độ headless mới, dùng được card đồ hoạ (~22 khung hình/giây).
  // Headless mặc định vẽ bằng phần mềm, bộ dò tay chỉ chạy ~2,5 khung hình/giây, không giống máy thật.
  const browser = await chromium.launch({
    channel: SLOW ? undefined : "chromium",
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-video-capture=${y4m(word, s)}`],
  });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, permissions: ["camera"], locale: "vi-VN" });
  const page = await ctx.newPage();
  await page.addInitScript((auto) => {
    localStorage.setItem("vsl-profile-v1", JSON.stringify({ name: "Thử", region: "hcm", onboarded: true, vibrate: false, flash: false, slowVideo: false, autoSign: auto }));
  }, MODE === "auto");
  await page.goto(`${BASE}/practice/?word=${encodeURIComponent(word)}`);
  await page.getByRole("button", { name: /Tập trước camera/ }).click();

  const seen = [];
  const stats = () =>
    page.evaluate((w) => {
      const p = JSON.parse(localStorage.getItem("vsl-progress-v1") || "{}");
      const card = document.querySelector("section.card.card--row");
      return { ...(p.words?.[w] ?? { attempts: 0, correct: 0 }), card: card ? card.textContent : "" };
    }, word);

  if (MODE === "auto") {
    await page.getByRole("status").filter({ hasText: /app tự chấm|Đang xem bạn ký|Đang chấm/ }).first().waitFor({ timeout: 60_000 });
    const end = Date.now() + SECS * 1000;
    while (Date.now() < end) {
      const st = await stats();
      if (st.card && st.card !== seen.at(-1)) seen.push(st.card);
      await page.waitForTimeout(150);
    }
  } else {
    // bấm nút: mỗi vòng đếm 3-2-1 rồi ghi 2,5 giây
    for (let i = 0; i < 2; i++) {
      const btn = page.getByRole("button", { name: /Bắt đầu ký|Thử lại/ });
      await btn.waitFor({ timeout: 60_000 });
      await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /Bắt đầu ký|Thử lại/.test(b.textContent) && !b.disabled), null, { timeout: 60_000 });
      await btn.click();
      await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /Thử lại|Bắt đầu ký/.test(b.textContent) && !b.disabled), null, { timeout: 30_000 });
      const st = await stats();
      if (st.card) seen.push(st.card);
    }
  }
  const st = await stats();
  await browser.close();
  return { word, scenario: s.id, attempts: st.attempts, correct: st.correct, seen };
}

const jobs = words.flatMap((w) => SCENARIOS.map((s) => [w, s]));
const results = [];
let next = 0;
await Promise.all(
  Array.from({ length: JOBS }, async () => {
    while (next < jobs.length) {
      const [w, s] = jobs[next++];
      try {
        const r = await run(w, s);
        results.push(r);
        console.log(`${r.correct > 0 ? "ĐÚNG" : r.attempts ? "SAI " : "KHÔNG CHẤM"} · ${w} · ${s.id} · chấm ${r.attempts}, đúng ${r.correct} · ${r.seen.map((t) => t.replace(/\s+/g, " ").slice(0, 60)).join(" | ")}`);
      } catch (e) {
        results.push({ word: w, scenario: s.id, attempts: 0, correct: 0, error: String(e).slice(0, 200) });
        console.log(`LỖI · ${w} · ${s.id} · ${String(e).slice(0, 200)}`);
      }
    }
  })
);

const sum = (f) => results.reduce((n, r) => n + f(r), 0);
console.log("\n=== Tổng kết ===");
for (const s of SCENARIOS) {
  const rs = results.filter((r) => r.scenario === s.id);
  console.log(`${s.id}: có ít nhất một lần đúng ${rs.filter((r) => r.correct > 0).length}/${rs.length} từ · không chấm lần nào ${rs.filter((r) => !r.attempts).length}`);
}
console.log(`Tổng số lần chấm ${sum((r) => r.attempts)}, đúng ${sum((r) => r.correct)} (${Math.round((100 * sum((r) => r.correct)) / Math.max(1, sum((r) => r.attempts)))}%)`);
