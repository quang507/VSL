import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seedUser, ALL_PAGES } from "./helpers";

// Tầng 1 · Accessibility (WCAG 2.1 AA) bằng axe-core + kiểm tra vùng chạm ≥ 44×44px.
// Chạy trên iPhone (WebKit) và desktop; mỗi trang ghi kết quả chi tiết vào báo cáo HTML.

for (const path of ALL_PAGES) {
  test(`A11y · ${decodeURIComponent(path)}`, async ({ page }, info) => {
    test.skip(info.project.name === "android-chromium", "đã quét trên WebKit và desktop");
    await seedUser(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(500);

    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude("video").analyze();
    const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    await info.attach("axe.json", { body: JSON.stringify(res.violations, null, 2), contentType: "application/json" });

    // Vùng chạm: phần tử bấm được nhỏ hơn 44px (Apple HIG / WCAG 2.5.5)
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("a[href], button, [role=button], input, [role=switch]")]
        .filter((el) => el.offsetParent !== null && !el.closest(".sr-only"))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { t: (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) };
        })
        .filter((x) => x.w > 0 && (x.w < 44 || x.h < 44))
    );
    await info.attach("touch-targets.json", { body: JSON.stringify(small, null, 2), contentType: "application/json" });

    expect.soft(bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} chỗ — ${v.help}`), "vi phạm WCAG nghiêm trọng").toEqual([]);
    expect.soft(small, "vùng chạm < 44px").toEqual([]);
  });
}
