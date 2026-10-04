import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

const browser = await chromium.launch({ channel: "msedge" });
const context = await browser.newContext();
const page = await context.newPage();
await mkdir("docs/screenshots", { recursive: true });
await page.goto("http://127.0.0.1:5180/");
await page.setViewportSize({ width: 1280, height: 900 });
await page.getByRole("heading", { level: 1 }).waitFor();
await page.evaluate(() => document.fonts.ready);
await page.locator(".steps").scrollIntoViewIfNeeded();
await page
  .locator(".steps")
  .screenshot({ path: "docs/screenshots/redesign-walkthrough.png" });
await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
await page.screenshot({
  path: "docs/screenshots/redesign-desktop.png",
  fullPage: true,
});
await page.screenshot({path: "docs/screenshots/improved-first-screen.png"});
const emptyAudit = await new AxeBuilder({ page }).analyze();
console.log(
  JSON.stringify(
    {
      state: "empty",
      violations: emptyAudit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    },
    null,
    2,
  ),
);
await page.getByTestId("sample-pdfs").click();
await page.getByTestId("page-card").first().locator("canvas").waitFor();
for (const width of [1920, 1440, 1280, 1024, 820, 768, 620, 414, 375, 320]) {
  await page.setViewportSize({ width, height: 900 });
  console.log(
    JSON.stringify(
      await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overflow: [...document.querySelectorAll("main *")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.right > innerWidth + 1 || r.left < -1;
          })
          .slice(0, 12)
          .map((el) => ({
            tag: el.tagName,
            class: el.className,
            right: Math.round(el.getBoundingClientRect().right),
          })),
      })),
    ),
  );
}
console.log(
  JSON.stringify(
    {
      state: "mobile",
      violations: (await new AxeBuilder({ page }).analyze()).violations.map(
        (v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        }),
      ),
    },
    null,
    2,
  ),
);
await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
await page.screenshot({
  path: "docs/screenshots/redesign-mobile.png",
  fullPage: true,
});
await page.getByRole('button', {name: 'Export PDF', exact: true}).click();
await page.getByRole('dialog').screenshot({path: 'docs/screenshots/hallmark-export-320.png'});
console.log(JSON.stringify({state: 'mobile export', violations: (await new AxeBuilder({page}).analyze()).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))}));
await browser.close();
