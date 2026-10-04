import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import JSZip from "jszip";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const evidence = resolve("test-results-evidence");
test("organizes scanned image pages without dropping the embedded image", async ({
  page,
}) => {
  await page.goto("/");
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 120;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#d5ebe5";
    ctx.fillRect(0, 0, 240, 120);
    ctx.fillStyle = "#182d49";
    ctx.font = "20px sans-serif";
    ctx.fillText("Scanned fixture", 20, 60);
    return canvas.toDataURL("image/png");
  });
  const doc = await PDFDocument.create();
  const png = await doc.embedPng(image);
  doc
    .addPage([400, 600])
    .drawImage(png, { x: 30, y: 300, width: 240, height: 120 });
  await page.locator("input[type=file]").setInputFiles({
    name: "scan.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await doc.save()),
  });
  await expect(page.getByTestId("page-card")).toHaveCount(1);
  await expect(
    page.getByTestId("page-card").locator(".page-preview"),
  ).toHaveAttribute("aria-busy", "false");
  const path = await exportFile(page, "One organized PDF", "scanned.pdf");
  await writeFile(
    resolve(evidence, "scanned-manifest.json"),
    JSON.stringify([
      { path, pages: [{ text: "", width: 400, height: 600, image: true }] },
    ]),
  );
});
test("empty and mobile workspaces pass accessibility checks", async ({
  page,
}) => {
  await page.goto("/");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await sample(page);
  await page.setViewportSize({ width: 320, height: 900 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("cancels pending sample work truthfully and reorders pages by dragging", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    /\/(?:src\/lib\/pdf\.ts|assets\/pdf-[^/]+\.js)/,
    async (route) => {
      await gate;
      await route.continue();
    },
  );
  await page.goto("/");
  await page.getByTestId("sample-pdfs").click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  release();
  await expect(page.locator(".info-notice")).toHaveText(
    "Operation cancelled. Your workspace is unchanged.",
  );
  await expect(page.getByTestId("page-card")).toHaveCount(0);
  await sample(page);
  const secondId = await page
    .getByTestId("page-card")
    .nth(1)
    .getAttribute("data-page-id");
  await page
    .getByRole("button", { name: "Drag page 2 to reorder", exact: true })
    .dragTo(page.getByTestId("page-card").first(), {
      targetPosition: { x: 30, y: 100 },
    });
  await expect(page.getByTestId("page-card").first()).toHaveAttribute(
    "data-page-id",
    secondId!,
  );
  await expect(page.locator(".is-being-dragged, .is-drop-target")).toHaveCount(
    0,
  );
});
async function sample(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByTestId("sample-pdfs").click();
  await expect(page.getByTestId("page-card")).toHaveCount(5);
  await expect(
    page.getByTestId("page-card").first().locator("canvas"),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByTestId("page-card")
        .first()
        .locator("canvas")
        .evaluate((c) => (c as HTMLCanvasElement).width),
    )
    .toBeGreaterThan(0);
  await expect(
    page.getByTestId("page-card").first().locator(".page-preview"),
  ).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".page-preview__error")).toHaveCount(0);
  const ratioError = await page
    .getByTestId("page-card")
    .first()
    .locator("canvas")
    .evaluate((canvas) => {
      const box = canvas.getBoundingClientRect();
      const c = canvas as HTMLCanvasElement;
      return Math.abs(box.width / box.height - c.width / c.height);
    });
  expect(ratioError).toBeLessThan(0.03);
}
async function exportFile(
  page: import("@playwright/test").Page,
  mode: string,
  filename: string,
  ranges?: string,
) {
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  if (mode !== "One organized PDF")
    await page.getByRole("button", { name: new RegExp("^" + mode) }).click();
  if (ranges !== undefined) await page.getByLabel(/Page ranges/).fill(ranges);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name:
        mode === "Split into groups" || mode === "One PDF per page"
          ? "Download ZIP"
          : "Download PDF",
      exact: true,
    })
    .click();
  const download = await downloadPromise;
  await mkdir(evidence, { recursive: true });
  const path = resolve(evidence, filename);
  await download.saveAs(path);
  expect(download.suggestedFilename()).not.toMatch(/\.pdf\.pdf$/i);
  return path;
}

test("organize, undo and redo, and verify actual PDF/ZIP downloads", async ({
  page,
}) => {
  const faults: string[] = [];
  page.on("pageerror", (e) => faults.push(e.message));
  const requests: string[] = [];
  const badResponses: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("response", (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
  });
  await sample(page);
  await page
    .getByRole("button", { name: "Rotate page 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Move page 1 later", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove page 5", exact: true })
    .click();
  await expect(page.getByTestId("page-card")).toHaveCount(4);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByTestId("page-card")).toHaveCount(5);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByTestId("page-card")).toHaveCount(4);
  const merged = await exportFile(page, "One organized PDF", "merged.pdf");
  await page
    .getByRole("button", { name: "Select page 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select page 3", exact: true })
    .click();
  const extracted = await exportFile(page, "Selected pages", "selected.pdf");
  const split = await exportFile(
    page,
    "Split into groups",
    "split.zip",
    "1-2; 3-4",
  );
  const fs = await import("node:fs/promises");
  const zip = await JSZip.loadAsync(await fs.readFile(split));
  const splitPaths: string[] = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    expect(name).toMatch(/\.pdf$/);
    const path = resolve(evidence, "split-" + name);
    await writeFile(path, await entry.async("nodebuffer"));
    splitPaths.push(path);
  }
  expect(splitPaths).toHaveLength(2);
  const pdf = await PDFDocument.load(await fs.readFile(merged));
  expect(pdf.getPageCount()).toBe(4);
  expect(pdf.getPage(1).getRotation().angle).toBe(90);
  const checks = [
    {
      path: merged,
      pages: [
        { text: "APPLICATION LETTER" },
        { text: "CURRICULUM VITAE", rotation: 90 },
        { text: "CERTIFICATE 1" },
        { text: "CERTIFICATE 2" },
      ],
    },
    {
      path: extracted,
      pages: [{ text: "APPLICATION LETTER" }, { text: "CERTIFICATE 1" }],
    },
    {
      path: splitPaths[0],
      pages: [
        { text: "APPLICATION LETTER" },
        { text: "CURRICULUM VITAE", rotation: 90 },
      ],
    },
    {
      path: splitPaths[1],
      pages: [{ text: "CERTIFICATE 1" }, { text: "CERTIFICATE 2" }],
    },
  ];
  await writeFile(
    resolve(evidence, "manifest.json"),
    JSON.stringify(checks, null, 2),
  );
  expect(faults).toEqual([]);
  expect(badResponses).toEqual([]);
  expect(
    requests.filter(
      (url) =>
        !url.startsWith("http://127.0.0.1:5180/") &&
        !url.startsWith("blob:") &&
        !url.startsWith("data:"),
    ),
  ).toEqual([]);
});

test("reject invalid input while accepting valid PDFs and retain mixed-size page content", async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const first = doc.addPage([400, 600]);
  first.drawText("Portrait fixture", { x: 30, y: 500, font });
  const second = doc.addPage([720, 400]);
  second.drawText("Landscape fixture", { x: 30, y: 300, font });
  second.setRotation(degrees(90));
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles([
    {
      name: "mixed.PDF",
      mimeType: "application/pdf",
      buffer: Buffer.from(await doc.save()),
    },
    {
      name: "broken.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("not a pdf"),
    },
    { name: "empty.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(0) },
  ]);
  await expect(page.getByTestId("page-card")).toHaveCount(2);
  await expect(page.getByText(/does not contain a valid PDF/)).toBeVisible();
  await expect(page.getByText(/empty\.pdf/)).toBeVisible();
  const path = await exportFile(page, "One organized PDF", "mixed.pdf");
  await writeFile(
    resolve(evidence, "mixed-manifest.json"),
    JSON.stringify([
      {
        path,
        pages: [
          { text: "Portrait fixture", width: 400, height: 600 },
          { text: "Landscape fixture", width: 720, height: 400, rotation: 90 },
        ],
      },
    ]),
  );
});

test("range validation, keyboard dialog focus and accessibility", async ({
  page,
}) => {
  await sample(page);
  await page
    .getByRole("button", { name: "Preview page 1", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").locator(".page-preview"),
  ).toHaveAttribute("aria-busy", "false");
  const previewRatioError = await page
    .getByRole("dialog")
    .locator("canvas")
    .evaluate((canvas) => {
      const box = canvas.getBoundingClientRect();
      const c = canvas as HTMLCanvasElement;
      return Math.abs(box.width / box.height - c.width / c.height);
    });
  expect(previewRatioError).toBeLessThan(0.03);
  for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
  expect(
    await page
      .getByRole("dialog")
      .evaluate((d) => d.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  await page.getByRole("button", { name: /^Split into groups/ }).click();
  await page.getByLabel(/Page ranges/).fill("1-2;2-5");
  await expect(
    page.getByRole("button", { name: "Download ZIP", exact: true }),
  ).toBeDisabled();
  await page.getByLabel(/Page ranges/).fill("1-2;;3-5");
  await expect(
    page.getByRole("button", { name: "Download ZIP", exact: true }),
  ).toBeDisabled();
  await page.getByLabel(/Page ranges/).fill("1-2;3-5");
  await expect(
    page.getByRole("button", { name: "Download ZIP", exact: true }),
  ).toBeEnabled();
  const modalAxe = await new AxeBuilder({ page }).analyze();
  expect(modalAxe.violations).toEqual([]);
  await page.keyboard.press("Escape");
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

test("desktop and narrow mobile layouts remain usable and produce screenshots", async ({
  page,
}) => {
  await sample(page);
  await mkdir("docs/screenshots", { recursive: true });
  for (const width of [1280, 768, 414, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator("#workspace").scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
    await expect(
      page.getByRole("button", { name: "Rotate page 1", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId("page-card").first().locator(".page-preview"),
    ).toHaveAttribute("aria-busy", "false");
    await expect(page.locator(".page-preview__error")).toHaveCount(0);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: `docs/screenshots/workspace-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await page
    .getByRole("button", { name: "Keep workspace", exact: true })
    .click();
  await expect(page.getByTestId("page-card")).toHaveCount(5);
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await page
    .getByRole("button", { name: "Clear workspace", exact: true })
    .click();
  await expect(page.getByTestId("page-card")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Export PDF", exact: true }),
  ).toBeDisabled();
});

test("selection ranges, bulk actions, keyboard undo, individual exports and repeat imports", async ({
  page,
}) => {
  await sample(page);
  await page.getByLabel("Select pages", { exact: true }).fill("1-2");
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page
    .getByRole("button", { name: "Rotate selected pages", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove selected pages", exact: true })
    .click();
  await expect(page.getByTestId("page-card")).toHaveCount(3);
  await page.keyboard.press("Control+z");
  await expect(page.getByTestId("page-card")).toHaveCount(5);
  const path = await exportFile(page, "One PDF per page", "individual.zip");
  const fs = await import("node:fs/promises");
  const zip = await JSZip.loadAsync(await fs.readFile(path));
  expect(Object.keys(zip.files)).toHaveLength(5);
  for (const entry of Object.values(zip.files))
    expect(
      (await PDFDocument.load(await entry.async("uint8array"))).getPageCount(),
    ).toBe(1);
  const doc = await PDFDocument.create();
  doc.addPage();
  const bytes = Buffer.from(await doc.save());
  await page.locator("input[type=file]").setInputFiles([
    { name: "same.pdf", mimeType: "application/pdf", buffer: bytes },
    { name: "same.pdf", mimeType: "application/pdf", buffer: bytes },
  ]);
  await expect(page.getByTestId("page-card")).toHaveCount(7);
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  await page.getByLabel("File name", { exact: true }).fill("");
  await expect(
    page.getByRole("button", { name: "Download PDF", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
});

test("enforces imported page limit, keeps near-limit workspace responsive and previews multiple sources", async ({
  page,
}) => {
  const large = await PDFDocument.create();
  for (let i = 0; i < 180; i++) large.addPage();
  const additional = await PDFDocument.create();
  for (let i = 0; i < 21; i++) additional.addPage();
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "large.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await large.save()),
  });
  await expect(page.getByTestId("page-card")).toHaveCount(180);
  await page.getByRole("button", { name: "Select all", exact: true }).click();
  await page
    .getByRole("button", { name: "Remove selected pages", exact: true })
    .click();
  await expect(page.getByTestId("page-card")).toHaveCount(0);
  await page.locator("input[type=file]").setInputFiles({
    name: "extra.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await additional.save()),
  });
  await expect(
    page.getByText(/exceed the 200-page workspace limit/),
  ).toBeVisible();
  await expect(page.getByTestId("page-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByTestId("page-card")).toHaveCount(180);
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await page
    .getByRole("button", { name: "Clear workspace", exact: true })
    .click();
  const small = await PDFDocument.create();
  small.addPage();
  const bytes = Buffer.from(await small.save());
  await page.locator("input[type=file]").setInputFiles(
    Array.from({ length: 11 }, (_, i) => ({
      name: `source-${i}.pdf`,
      mimeType: "application/pdf",
      buffer: bytes,
    })),
  );
  await expect(page.getByTestId("page-card")).toHaveCount(10);
  await expect(page.getByText(/supports up to 10 PDF files/)).toBeVisible();
  await page
    .getByRole("button", { name: "Preview page 4", exact: true })
    .click();
  await expect(page.getByRole("dialog").locator("canvas")).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByRole("dialog")
        .locator("canvas")
        .evaluate((c) => (c as HTMLCanvasElement).width),
    )
    .toBeGreaterThan(0);
});
