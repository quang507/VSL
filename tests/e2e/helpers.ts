import type { Page } from "@playwright/test";

/** Người dùng đã qua onboarding, có chút tiến độ — để các màn hiện đủ trạng thái. */
export async function seedUser(page: Page, opts: { progress?: boolean; saved?: string[] } = {}) {
  await page.addInitScript(
    ({ withProgress, saved }) => {
      if (sessionStorage.getItem("__seeded")) return; // chỉ gieo 1 lần mỗi tab
      sessionStorage.setItem("__seeded", "1");
      localStorage.setItem("vsl-profile-v1", JSON.stringify({ name: "Minh", region: "hcm", onboarded: true, vibrate: true, flash: true, slowVideo: false }));
      const now = Date.now();
      const key = (d: number) => {
        const t = new Date(now - d * 864e5);
        return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
      };
      if (withProgress)
        localStorage.setItem(
          "vsl-progress-v1",
          JSON.stringify({
            words: {
              Chào: { attempts: 3, correct: 3, box: 2, due: now - 1000, last: now - 3600e3 },
              "Cảm ơn": { attempts: 4, correct: 2, box: 1, due: now + 5e6, last: now - 60e3 },
              Ho: { attempts: 3, correct: 1, box: 0, due: now - 100, last: now - 7200e3 },
            },
            streak: 2,
            bestStreak: 4,
            score: 60,
            days: { [key(0)]: 3, [key(1)]: 5 },
            dailyGoal: 5,
            soundOn: true,
          })
        );
      else localStorage.removeItem("vsl-progress-v1");
      localStorage.setItem("vsl-saved-v1", JSON.stringify(saved));
    },
    { withProgress: opts.progress ?? true, saved: opts.saved ?? [] }
  );
}

export const MAIN_PAGES = ["/", "/luyen-tap/", "/tu-dien/", "/ho-so/"];
export const ALL_PAGES = [
  ...MAIN_PAGES,
  "/chao-mung/",
  "/tu-dien/tu/?w=t%C3%A1c%20%C4%91%E1%BB%99ng",
  "/tu-dien/luyen/?w=nh%C3%A2n%20vi%C3%AAn",
  "/practice/?word=Ch%C3%A0o&lesson=chao-hoi",
  "/lesson/?id=chao-hoi",
  "/cau/",
  "/cau/luyen/?i=13",
  "/dich/",
  "/the-ghi-nho/",
  "/quiz/",
  "/cai-dat/",
  "/quyen-rieng-tu/",
];
