import { test, expect } from "@playwright/test";
import { seedUser, MAIN_PAGES } from "./helpers";

// Mỗi test = một nhiệm vụ trong kịch bản usability (docs/TEST_PLAN.md mục 6), chạy tự động.

test("N1 · Onboarding: người mới đặt tên, vùng, mục tiêu rồi vào học", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/chao-mung/);
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await page.getByLabel("Tên hiển thị").fill("Lan");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByRole("button", { name: /Hà Nội/ }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByRole("button", { name: /Nghiêm túc/ }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByRole("button", { name: "Vào học" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/, Lan$/)).toBeVisible();
  await expect(page.getByText("0 / 10 lần ký đúng")).toBeVisible();
});

test("N2 · Học tiếp: từ Lộ trình mở đúng bài đang học", async ({ page }) => {
  await seedUser(page);
  await page.goto("/");
  const card = page.getByRole("region", { name: "Tiếp tục học" });
  const word = (await card.getByRole("heading").textContent())!.trim();
  await card.getByRole("link", { name: /Học tiếp/ }).click();
  await expect(page).toHaveURL(/practice/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(word);
  // Bài bị khoá không bấm được (không phải link)
  await page.goBack();
  await expect(page.getByLabel(/chưa mở$/).first()).toBeVisible();
  expect(await page.getByLabel(/chưa mở$/).first().evaluate((el) => el.tagName)).not.toBe("A");
});

test("N3 · Tra từ không dấu, cả hai nguồn", async ({ page }) => {
  await seedUser(page);
  await page.goto("/tu-dien/");
  const box = page.getByRole("textbox", { name: /Tìm từ/ });
  await box.fill("benh vien");
  await expect(page.getByRole("link", { name: /Bệnh viện/ }).first()).toBeVisible();
  await box.fill("tac dong");
  await page.getByRole("link", { name: /^tác động/ }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("tác động");
  // Từ hai nghĩa: mỗi nghĩa có video riêng
  await page.getByRole("button", { name: /Nghĩa 2/ }).click();
  await expect(page.locator("video")).toHaveAttribute("src", /W03055\.mp4$/);
});

test("N4 · Lưu từ rồi tìm lại ở Từ điển và Hồ sơ", async ({ page }) => {
  await seedUser(page, { saved: [] });
  await page.goto("/tu-dien/tu/?w=nh%C3%A2n%20vi%C3%AAn");
  await page.getByRole("button", { name: /Lưu “nhân viên”/ }).click();
  await expect(page.getByRole("button", { name: /Bỏ lưu “nhân viên”/ })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/tu-dien/");
  await expect(page.getByRole("heading", { name: "Đã lưu gần đây" })).toBeVisible();
  await page.goto("/ho-so/");
  await expect(page.getByRole("link", { name: /1 từ\s*Đã lưu/ })).toBeVisible();
});

test("N5 · Ôn tập: số từ đến hạn khớp giữa các màn", async ({ page }) => {
  await seedUser(page);
  await page.goto("/luyen-tap/");
  const hero = page.getByRole("region", { name: "Từ đến hạn ôn" });
  await expect(hero.getByText("2", { exact: true })).toBeVisible();
  await expect(hero.getByRole("link", { name: "Ôn ngay" })).toBeVisible();
  await page.goto("/tu-dien/");
  await expect(page.getByText("2 từ cần ôn lại")).toBeVisible();
});

test("N6 · Câu giao tiếp: 59 câu, câu chưa rõ nghĩa bị ẩn", async ({ page }) => {
  await seedUser(page);
  await page.goto("/cau/");
  await expect(page.locator(".list-row")).toHaveCount(59);
  await expect(page.getByText("trông cậu")).toHaveCount(0);
});

test("N7 · Thanh điều hướng đi được 4 tab; nút tìm mở ô tìm", async ({ page, isMobile }) => {
  await seedUser(page);
  await page.goto("/");
  for (const [name, url] of [
    ["Luyện tập", /luyen-tap/],
    ["Từ điển", /tu-dien/],
    ["Hồ sơ", /ho-so/],
    ["Lộ trình", /\/$/],
  ] as const) {
    await page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name }).click();
    await expect(page).toHaveURL(url);
  }
  if (isMobile) {
    await page.getByRole("link", { name: "Tìm từ" }).click();
    await expect(page.getByRole("textbox", { name: /Tìm từ/ })).toBeFocused();
  }
});

test("N8 · Luyện với camera: thấy khung camera và gợi ý đưa tay vào khung", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium" || test.info().project.name !== "android-chromium", "camera giả chỉ có trên Chromium Android");
  await seedUser(page);
  await page.goto("/practice/?word=Ch%C3%A0o&lesson=chao-hoi");
  await page.getByRole("button", { name: /Tập trước camera/ }).click();
  await expect(page.getByText(/Đưa tay vào khung|Tay sắp ra ngoài/)).toBeVisible({ timeout: 20_000 });
});

test("N9 · Không cần mạng ngoài: chặn mọi máy chủ khác, vẫn học và luyện camera được", async ({ page }) => {
  test.skip(test.info().project.name !== "android-chromium", "cần camera giả");
  const external: string[] = [];
  await page.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "localhost") return route.continue();
    external.push(u.hostname);
    return route.abort();
  });
  await seedUser(page);
  await page.goto("/");
  await page.getByRole("region", { name: "Tiếp tục học" }).getByRole("link", { name: /Học tiếp/ }).click();
  await expect(page.locator(".media video")).toHaveJSProperty("readyState", 4);
  await page.getByRole("button", { name: /Tập trước camera/ }).click();
  // Bộ nhận diện tay và model đều nằm trong app
  await expect(page.getByText(/Đưa tay vào khung|Tay sắp ra ngoài/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Bắt đầu ký" })).toBeEnabled({ timeout: 20_000 });
  expect(external, "app không được gọi máy chủ ngoài ở luồng học chính").toEqual([]);
});

for (const w of [320, 390, 768, 1280]) {
  test(`R · không cuộn ngang ở ${w}px`, async ({ page }) => {
    test.skip(test.info().project.name !== "desktop-chromium", "đo một lần trên desktop-chromium");
    await seedUser(page);
    await page.setViewportSize({ width: w, height: 800 });
    for (const p of [...MAIN_PAGES, "/chao-mung/", "/tu-dien/tu/?w=t%C3%A1c%20%C4%91%E1%BB%99ng"]) {
      await page.goto(p);
      await page.waitForLoadState("networkidle").catch(() => {});
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect.soft(over, `${p} tràn ${over}px ở ${w}px`).toBeLessThanOrEqual(0);
    }
  });
}
