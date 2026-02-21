import { expect, test } from "@playwright/test";

const routes = [
  { path: "/", heading: /dashboard/i },
  { path: "/split", heading: /분할 작업/ },
  { path: "/browse", heading: /카드 브라우저/ },
  { path: "/backups", heading: /백업 관리/ },
  { path: "/prompts", heading: /프롬프트 관리/ },
  { path: "/help", heading: /도움말/ },
] as const;

test("core routes render without crash", async ({ page }) => {
  for (const route of routes) {
    await page.goto(route.path);
    await expect(
      page.getByRole("heading", { name: route.heading }),
    ).toBeVisible();
  }
});

test("dashboard shows deck selector trigger", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("combobox").first()).toBeVisible();
});
