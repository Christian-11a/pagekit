import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Hallmark forms keep errors attached, controls aligned and export titles readable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("sample-pdfs").click();
  await expect(page.getByTestId("page-card")).toHaveCount(5);
  const selection = page.getByLabel("Select pages", { exact: true });
  const inputHeight = await selection.evaluate(
    (el) => el.getBoundingClientRect().height,
  );
  const buttonHeight = await page
    .getByRole("button", { name: "Select", exact: true })
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(inputHeight).toBeGreaterThanOrEqual(44);
  expect(Math.abs(inputHeight - buttonHeight)).toBeLessThan(1);
  await selection.fill("999");
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await expect(selection).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#selection-help")).not.toBeEmpty();
  await selection.fill("1-2");
  await expect(selection).toHaveAttribute("aria-invalid", "false");
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  const titleLines = await page
    .locator(".mode-card strong")
    .evaluateAll((nodes) =>
      nodes.map((n) => {
        const range = document.createRange();
        range.selectNodeContents(n);
        return new Set(
          [...range.getClientRects()].map((r) => Math.round(r.top)),
        ).size;
      }),
    );
  expect(titleLines).toEqual([1, 1, 1, 1]);
  const filename = page.getByLabel("File name", { exact: true });
  const before = await page
    .locator(".final-summary")
    .evaluate((el) => el.getBoundingClientRect().top);
  await filename.fill("");
  await expect(filename).toHaveAttribute("aria-invalid", "false");
  await filename.blur();
  await expect(filename).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#filename-help")).toContainText("Enter a name");
  const after = await page
    .locator(".final-summary")
    .evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.abs(after - before)).toBeLessThan(1);
  await filename.fill("application");
  await expect(filename).toHaveAttribute("aria-invalid", "false");
  await page.getByRole("button", { name: /^Split into groups/ }).click();
  const ranges = page.getByLabel(/Page ranges/);
  await ranges.fill("1-2;2-5");
  await ranges.blur();
  await expect(ranges).toHaveAttribute("aria-invalid", "true");
  await expect(ranges).toHaveAttribute("aria-describedby", "ranges-help");
  await ranges.fill("1-2;3-5");
  await expect(ranges).toHaveAttribute("aria-invalid", "false");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("hero samples lead into a compact readable editing workspace", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your PDF pages,in order.",
  );
  await expect(page.locator(".intro-art")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () =>
          [...document.querySelectorAll("main *")].filter((el) => {
            const r = el.getBoundingClientRect();
            return r.left < -1 || r.right > innerWidth + 1;
          }).length,
      ),
    ).toBe(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.screenshot({
    path: "docs/screenshots/improved-hero-320.png",
    fullPage: true,
  });
  await page.getByTestId("hero-samples").click();
  await expect(page.getByTestId("page-card")).toHaveCount(5);
  await expect(page.locator(".intro-is-active")).toBeVisible();
  await expect(page.locator(".intro-art")).toHaveCount(0);
  expect(
    await page
      .locator(".intro")
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBeLessThan(180);
  expect(
    await page
      .locator(".preview-button")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(12);
  await expect(
    page.getByRole("button", { name: "Export PDF", exact: true }),
  ).toBeEnabled();
});
