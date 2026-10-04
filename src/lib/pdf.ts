import { degrees, PDFDocument, PDFName, StandardFonts, rgb } from "pdf-lib";
import type { SourceDocument, WorkspacePage } from "../types";

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PAGES = 200;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

function printableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/encrypt|password|decrypt/i.test(message))
    return "Password-protected or encrypted PDFs are not supported.";
  return "This PDF could not be read. It may be damaged or use an unsupported PDF feature.";
}

/** Reads and validates a static, unencrypted PDF. The returned bytes are owned by PageKit. */
export async function importPdf(file: File): Promise<SourceDocument> {
  if (!file.size)
    throw new Error("This file is empty. Choose a PDF with content.");
  if (file.size > MAX_PDF_BYTES)
    throw new Error("This PDF is larger than the 20 MiB per-file limit.");
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
    throw new Error("Choose a PDF file.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (
    bytes.length < 5 ||
    new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-"
  ) {
    throw new Error("This file does not contain a valid PDF.");
  }
  let document: PDFDocument;
  try {
    document = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    throw new Error(printableError(error));
  }
  if (!document.getPageCount()) throw new Error("This PDF has no pages.");
  if (document.getPageCount() > MAX_PAGES)
    throw new Error("This PDF has more than the 200-page limit.");

  // pdf-lib copies visible page content but does not preserve these document-level features.
  const catalog = document.catalog;
  const featureNames: Array<[string, string]> = [
    ["AcroForm", "interactive forms or digital signatures"],
    ["Outlines", "bookmarks"],
    ["StructTreeRoot", "accessibility structure"],
    ["Names", "embedded files or named destinations"],
    ["OpenAction", "document actions"],
  ];
  for (const [key, label] of featureNames) {
    if (catalog.get(PDFName.of(key)))
      throw new Error(
        `This PDF contains ${label}, which PageKit cannot safely preserve.`,
      );
  }
  const hasAnnotations = document.getPages().some((page) => {
    const annotationRef = page.node.get(PDFName.of("Annots"));
    if (!annotationRef) return false;
    const annotations = document.context.lookup(annotationRef) as {
      size?: () => number;
    };
    return typeof annotations.size !== "function" || annotations.size() > 0;
  });
  if (hasAnnotations)
    throw new Error(
      "This PDF contains annotations or signatures, which PageKit cannot safely preserve.",
    );

  return {
    id: crypto.randomUUID(),
    name: file.name,
    bytes: new Uint8Array(bytes),
    pageCount: document.getPageCount(),
    size: file.size,
  };
}

/** Builds a new PDF in workspace order, copying original page content and applying rotation deltas. */
export async function exportPdf(
  sources: SourceDocument[],
  pages: WorkspacePage[],
  parsed = new Map<string, PDFDocument>(),
): Promise<Uint8Array> {
  if (!pages.length) throw new Error("Add at least one page before exporting.");
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  let totalSize = 0;
  for (const source of sources) {
    totalSize += source.bytes.byteLength;
    if (totalSize > MAX_TOTAL_BYTES)
      throw new Error("The combined source files exceed the 50 MiB limit.");
  }
  if (pages.length > MAX_PAGES)
    throw new Error("The output cannot exceed 200 pages.");
  for (const page of pages) {
    const source = sourceMap.get(page.sourceId);
    if (!source)
      throw new Error(
        "A page refers to a source PDF that is no longer available.",
      );
    if (
      !Number.isInteger(page.pageIndex) ||
      page.pageIndex < 0 ||
      page.pageIndex >= source.pageCount
    ) {
      throw new Error(
        "A page refers to an invalid position in its source PDF.",
      );
    }
    if (!Number.isFinite(page.rotation) || page.rotation % 90 !== 0) {
      throw new Error("Page rotation must use 90-degree increments.");
    }
    if (!parsed.has(source.id)) {
      try {
        parsed.set(
          source.id,
          await PDFDocument.load(new Uint8Array(source.bytes), {
            updateMetadata: false,
          }),
        );
      } catch (error) {
        throw new Error(printableError(error));
      }
    }
  }

  const output = await PDFDocument.create();
  for (const page of pages) {
    const source = sourceMap.get(page.sourceId)!;
    const copied = await output.copyPages(parsed.get(source.id)!, [
      page.pageIndex,
    ]);
    const outPage = copied[0];
    const existing = outPage.getRotation().angle;
    const normalized = (((existing + page.rotation) % 360) + 360) % 360;
    outPage.setRotation(degrees(normalized));
    output.addPage(outPage);
  }
  return new Uint8Array(await output.save({ useObjectStreams: true }));
}

/** Reuse source parsing for every file in one split or individual-page export. */
export function createPdfExporter(sources: SourceDocument[]) {
  const parsed = new Map<string, PDFDocument>();
  return (pages: WorkspacePage[]) => exportPdf(sources, pages, parsed);
}

/** Two privacy-safe sample PDFs containing five visibly distinct pages in total. */
export async function createSamples(): Promise<File[]> {
  const navy = rgb(0.09, 0.17, 0.28);
  const ink = rgb(0.15, 0.22, 0.3);
  const muted = rgb(0.42, 0.48, 0.54);
  const paper = rgb(0.985, 0.98, 0.96);
  const pale = rgb(0.91, 0.93, 0.94);
  const teal = rgb(0.15, 0.48, 0.49);
  const gold = rgb(0.73, 0.52, 0.23);
  const specs = [
    { name: "Application-pack.pdf", pages: ["Resume", "Cover letter"] },
    {
      name: "Certificates.pdf",
      pages: ["Certificate 1", "Certificate 2", "Certificate 3"],
    },
  ];
  const files: File[] = [];
  for (const spec of specs) {
    const doc = await PDFDocument.create();
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    spec.pages.forEach((label, index) => {
      const page = doc.addPage([612, 792]);
      page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: paper });
      const footer = () => {
        page.drawRectangle({
          x: 54,
          y: 48,
          width: 504,
          height: 1,
          color: pale,
        });
        page.drawText("PageKit sample | no personal data", {
          x: 54,
          y: 30,
          size: 8,
          font: regular,
          color: muted,
        });
      };
      const section = (title: string, y: number) => {
        page.drawText(title, { x: 54, y, size: 10, font: bold, color: teal });
        page.drawRectangle({
          x: 54,
          y: y - 9,
          width: 504,
          height: 1,
          color: pale,
        });
      };

      if (label === "Resume") {
        page.drawRectangle({
          x: 0,
          y: 640,
          width: 612,
          height: 152,
          color: navy,
        });
        page.drawRectangle({
          x: 54,
          y: 754,
          width: 32,
          height: 3,
          color: gold,
        });
        page.drawText("CURRICULUM VITAE", {
          x: 54,
          y: 735,
          size: 8,
          font: bold,
          color: rgb(0.72, 0.82, 0.85),
        });
        page.drawText("SAMPLE CANDIDATE", {
          x: 54,
          y: 696,
          size: 24,
          font: bold,
          color: rgb(1, 1, 1),
        });
        page.drawText("Computer Science Student  /  Product-minded Developer", {
          x: 54,
          y: 672,
          size: 10,
          font: regular,
          color: rgb(0.83, 0.88, 0.91),
        });
        page.drawText(
          "sample@example.test  |  portfolio.example  |  Manila, PH",
          {
            x: 54,
            y: 651,
            size: 8,
            font: regular,
            color: rgb(0.83, 0.88, 0.91),
          },
        );

        section("PROFILE", 608);
        page.drawText(
          "Curious CS student who enjoys turning practical problems into",
          { x: 54, y: 581, size: 10, font: regular, color: ink },
        );
        page.drawText(
          "clear, useful tools. Comfortable learning new technologies and",
          { x: 54, y: 566, size: 10, font: regular, color: ink },
        );
        page.drawText("working through details with care.", {
          x: 54,
          y: 551,
          size: 10,
          font: regular,
          color: ink,
        });

        section("PROJECT EXPERIENCE", 516);
        page.drawText("Open-source project  /  ImagePrep", {
          x: 54,
          y: 488,
          size: 11,
          font: bold,
          color: ink,
        });
        page.drawText(
          "Built a simple image preparation workflow with a focus on",
          { x: 54, y: 470, size: 9, font: regular, color: muted },
        );
        page.drawText(
          "accessible controls, helpful errors, and local processing.",
          { x: 54, y: 456, size: 9, font: regular, color: muted },
        );
        page.drawText("Portfolio project  /  PDF organizer", {
          x: 54,
          y: 428,
          size: 11,
          font: bold,
          color: ink,
        });
        page.drawText(
          "Designed a page-based workflow for combining and arranging",
          { x: 54, y: 410, size: 9, font: regular, color: muted },
        );
        page.drawText("documents while keeping files in the browser.", {
          x: 54,
          y: 396,
          size: 9,
          font: regular,
          color: muted,
        });

        section("EDUCATION", 357);
        page.drawText("Bachelor of Science in Computer Science", {
          x: 54,
          y: 330,
          size: 11,
          font: bold,
          color: ink,
        });
        page.drawText("University Name  /  Expected graduation: 2027", {
          x: 54,
          y: 312,
          size: 9,
          font: regular,
          color: muted,
        });

        section("TOOLS & STRENGTHS", 273);
        const skills = ["TypeScript", "React", "Python", "Git", "UI basics"];
        skills.forEach((skill, i) => {
          const x = 54 + i * 101;
          page.drawRectangle({
            x,
            y: 227,
            width: 91,
            height: 28,
            color: pale,
            borderColor: pale,
            borderWidth: 0.5,
          });
          page.drawText(skill, {
            x: x + 9,
            y: 237,
            size: 8,
            font: bold,
            color: navy,
          });
        });
        footer();
      } else if (label === "Cover letter") {
        page.drawRectangle({
          x: 0,
          y: 752,
          width: 612,
          height: 40,
          color: navy,
        });
        page.drawText("APPLICATION LETTER", {
          x: 54,
          y: 766,
          size: 10,
          font: bold,
          color: rgb(1, 1, 1),
        });
        page.drawText("SAMPLE DOCUMENT  /  03 OCTOBER 2026", {
          x: 54,
          y: 710,
          size: 9,
          font: bold,
          color: teal,
        });
        page.drawText("HIRING TEAM", {
          x: 54,
          y: 674,
          size: 12,
          font: bold,
          color: ink,
        });
        page.drawText("Organization Name", {
          x: 54,
          y: 657,
          size: 10,
          font: regular,
          color: muted,
        });
        page.drawText("Department or Team", {
          x: 54,
          y: 642,
          size: 10,
          font: regular,
          color: muted,
        });
        page.drawText("SUBJECT  /  OJT APPLICATION", {
          x: 54,
          y: 602,
          size: 9,
          font: bold,
          color: navy,
        });
        page.drawRectangle({
          x: 54,
          y: 588,
          width: 205,
          height: 2,
          color: gold,
        });
        page.drawText("Dear Hiring Team,", {
          x: 54,
          y: 548,
          size: 11,
          font: bold,
          color: ink,
        });
        page.drawText(
          "I am a fourth-year Computer Science student applying for an",
          { x: 54, y: 520, size: 10, font: regular, color: ink },
        );
        page.drawText(
          "on-the-job training opportunity. I enjoy building small tools",
          { x: 54, y: 504, size: 10, font: regular, color: ink },
        );
        page.drawText("that make everyday tasks easier for people.", {
          x: 54,
          y: 488,
          size: 10,
          font: regular,
          color: ink,
        });
        page.drawText(
          "My portfolio includes projects that helped me practice user",
          { x: 54, y: 451, size: 10, font: regular, color: ink },
        );
        page.drawText(
          "interface design, file handling, and careful testing. I would",
          { x: 54, y: 435, size: 10, font: regular, color: ink },
        );
        page.drawText(
          "be glad to contribute, learn from your team, and grow my",
          { x: 54, y: 419, size: 10, font: regular, color: ink },
        );
        page.drawText("skills through real project work.", {
          x: 54,
          y: 403,
          size: 10,
          font: regular,
          color: ink,
        });
        page.drawText(
          "Thank you for your time and consideration. I look forward to",
          { x: 54, y: 366, size: 10, font: regular, color: ink },
        );
        page.drawText("the opportunity to discuss how I can help.", {
          x: 54,
          y: 350,
          size: 10,
          font: regular,
          color: ink,
        });
        page.drawText("Sincerely,", {
          x: 54,
          y: 302,
          size: 10,
          font: regular,
          color: ink,
        });
        page.drawRectangle({
          x: 54,
          y: 267,
          width: 118,
          height: 1,
          color: pale,
        });
        page.drawText("SAMPLE CANDIDATE", {
          x: 54,
          y: 248,
          size: 10,
          font: bold,
          color: navy,
        });
        page.drawText("Computer Science Student", {
          x: 54,
          y: 232,
          size: 9,
          font: regular,
          color: muted,
        });
        footer();
      } else {
        const accent = index === 1 ? teal : index === 2 ? navy : gold;
        page.drawRectangle({
          x: 26,
          y: 24,
          width: 560,
          height: 744,
          borderColor: accent,
          borderWidth: 2,
        });
        page.drawRectangle({
          x: 35,
          y: 33,
          width: 542,
          height: 726,
          borderColor: pale,
          borderWidth: 1,
        });
        page.drawText(label.toUpperCase(), {
          x: 54,
          y: 724,
          size: 8,
          font: bold,
          color: muted,
        });
        page.drawRectangle({
          x: 269,
          y: 674,
          width: 74,
          height: 2,
          color: accent,
        });
        const title = "CERTIFICATE OF COMPLETION";
        page.drawText(title, {
          x: (612 - bold.widthOfTextAtSize(title, 18)) / 2,
          y: 634,
          size: 18,
          font: bold,
          color: navy,
        });
        page.drawText("This sample is presented to", {
          x: 205,
          y: 590,
          size: 11,
          font: regular,
          color: muted,
        });
        page.drawCircle({
          x: 306,
          y: 514,
          size: 43,
          color: accent,
          borderColor: accent,
          borderWidth: 1,
        });
        page.drawCircle({
          x: 306,
          y: 514,
          size: 34,
          borderColor: rgb(1, 1, 1),
          borderWidth: 1,
        });
        page.drawText(String(index + 1).padStart(2, "0"), {
          x: 294,
          y: 508,
          size: 16,
          font: bold,
          color: rgb(1, 1, 1),
        });
        const recipient = "SAMPLE LEARNER";
        page.drawText(recipient, {
          x: (612 - bold.widthOfTextAtSize(recipient, 22)) / 2,
          y: 446,
          size: 22,
          font: bold,
          color: navy,
        });
        page.drawRectangle({
          x: 172,
          y: 430,
          width: 268,
          height: 1,
          color: pale,
        });
        page.drawText("for completing the sample learning module", {
          x: 188,
          y: 400,
          size: 11,
          font: regular,
          color: muted,
        });
        const courses = [
          "INTRODUCTION TO WEB DEVELOPMENT",
          "ACCESSIBLE INTERFACE DESIGN",
          "PRACTICAL DATA WORKFLOWS",
        ];
        const course = courses[index];
        page.drawText(course, {
          x: (612 - bold.widthOfTextAtSize(course, 11)) / 2,
          y: 368,
          size: 11,
          font: bold,
          color: accent,
        });
        page.drawRectangle({
          x: 128,
          y: 278,
          width: 150,
          height: 1,
          color: pale,
        });
        page.drawRectangle({
          x: 334,
          y: 278,
          width: 150,
          height: 1,
          color: pale,
        });
        page.drawText("SAMPLE DATE", {
          x: 175,
          y: 260,
          size: 8,
          font: bold,
          color: muted,
        });
        page.drawText("SAMPLE INSTRUCTOR", {
          x: 358,
          y: 260,
          size: 8,
          font: bold,
          color: muted,
        });
        page.drawText(
          `REFERENCE  /  SAMPLE-${String(index + 1).padStart(3, "0")}`,
          { x: 203, y: 96, size: 8, font: regular, color: muted },
        );
        footer();
      }
    });
    const saved = await doc.save();
    const blob = new Blob([new Uint8Array(saved).buffer], {
      type: "application/pdf",
    });
    files.push(new File([blob], spec.name, { type: "application/pdf" }));
  }
  return files;
}
