import { expect, test } from "@playwright/test";

const routes = [
  { path: "/", heading: /dashboard/i },
  { path: "/split", heading: /분할 작업/ },
  { path: "/history", heading: /분할 이력/ },
  { path: "/browse", heading: /카드 브라우저/ },
  { path: "/backups", heading: /백업 관리/ },
  { path: "/prompts", heading: /프롬프트 관리/ },
  { path: "/help", heading: /도움말/ },
] as const;

for (const route of routes) {
  test(`route ${route.path} renders without crash`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
  });
}

test("dashboard shows deck selector trigger", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("combobox").first()).toBeVisible();
});

test("prompts page shows remote system prompt editor", async ({ page }) => {
  await page.goto("/prompts");
  await expect(page.getByText("시스템 프롬프트 원격 편집")).toBeVisible();
});
