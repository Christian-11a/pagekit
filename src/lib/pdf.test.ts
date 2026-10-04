import { describe, expect, it, vi } from "vitest";
import { degrees, PDFDocument, PDFName } from "pdf-lib";
import { createSamples, exportPdf, importPdf, createPdfExporter } from "./pdf";
import type { SourceDocument, WorkspacePage } from "../types";

async function sourceFixture(): Promise<SourceDocument> {
  const doc = await PDFDocument.create();
  const a = doc.addPage([300, 500]);
  a.drawText("CONTENT ALPHA");
  a.setRotation(degrees(90));
  const b = doc.addPage([600, 400]);
  b.drawText("CONTENT BRAVO");
  const bytes = new Uint8Array(await doc.save());
  return {
    id: "fixture",
    name: "fixture.pdf",
    bytes,
    pageCount: 2,
    size: bytes.length,
  };
}

function fileOf(name: string, bytes: Uint8Array): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer], name, { type: "application/pdf" });
}

function encryptedFixture(): Uint8Array {
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << >> /Contents 4 0 R >> endobj\n",
    "4 0 obj << /Length 0 >> stream\n\nendstream endobj\n",
    "5 0 obj << /Filter /Standard /V 1 /R 2 /O <0000000000000000000000000000000000000000000000000000000000000000> /U <0000000000000000000000000000000000000000000000000000000000000000> /P -4 >> endobj\n",
  ];
  const head = "%PDF-1.4\n";
  const offsets = [0];
  let body = head;
  for (const object of objects) {
    offsets.push(new TextEncoder().encode(body).length);
    body += object;
  }
  const xrefOffset = new TextEncoder().encode(body).length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Encrypt 5 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(body);
}

describe("PDF engine", () => {
  it("parses a source only once when exporting multiple individual PDFs", async () => {
    const source = await sourceFixture();
    const load = vi.spyOn(PDFDocument, "load");
    try {
      const exportOne = createPdfExporter([source]);
      await exportOne([
        { id: "a", sourceId: source.id, pageIndex: 0, rotation: 0 },
      ]);
      await exportOne([
        { id: "b", sourceId: source.id, pageIndex: 1, rotation: 0 },
      ]);
      expect(load).toHaveBeenCalledTimes(1);
    } finally {
      load.mockRestore();
    }
  });
  it("exports requested page order, dimensions, existing rotation plus delta, and copied page content", async () => {
    const source = await sourceFixture();
    const pages: WorkspacePage[] = [
      { id: "b", sourceId: source.id, pageIndex: 1, rotation: 90 },
      { id: "a", sourceId: source.id, pageIndex: 0, rotation: 90 },
    ];
    const out = await PDFDocument.load(await exportPdf([source], pages));
    expect(out.getPageCount()).toBe(2);
    expect(out.getPage(0).getSize()).toEqual({ width: 600, height: 400 });
    expect(out.getPage(0).getRotation().angle).toBe(90);
    expect(out.getPage(1).getSize()).toEqual({ width: 300, height: 500 });
    expect(out.getPage(1).getRotation().angle).toBe(180);
    for (const page of out.getPages()) {
      const content = page.node.get(PDFName.of("Contents"));
      expect(content).toBeTruthy();
      const resolved = out.context.lookup(content!) as {
        asArray?: () => unknown[];
        getContents?: () => Uint8Array;
      };
      const streams = resolved
        .asArray?.()
        .map(
          (ref) =>
            out.context.lookup(
              ref as Parameters<typeof out.context.lookup>[0],
            ) as { getContents?: () => Uint8Array },
        ) ?? [resolved];
      expect(
        streams.some((stream) => (stream.getContents?.().length ?? 0) > 0),
      ).toBe(true);
      expect(page.node.get(PDFName.of("Resources"))).toBeTruthy();
    }
  });

  it("imports valid PDFs into immutable byte copies and rejects empty, fake, encrypted, and interactive-form files", async () => {
    const source = await sourceFixture();
    const good = fileOf("GOOD.PDF", source.bytes);
    const imported = await importPdf(good);
    expect(imported.name).toBe("GOOD.PDF");
    expect(imported.pageCount).toBe(2);
    expect(imported.bytes).not.toBe(source.bytes);
    await expect(
      importPdf(fileOf("empty.pdf", new Uint8Array())),
    ).rejects.toThrow(/empty/i);
    await expect(
      importPdf(fileOf("fake.pdf", new TextEncoder().encode("not pdf"))),
    ).rejects.toThrow(/does not contain/i);
    await expect(
      importPdf(fileOf("locked.pdf", encryptedFixture())),
    ).rejects.toThrow(/encrypted|password/i);

    const formDoc = await PDFDocument.create();
    formDoc.addPage();
    formDoc.getForm().createTextField("student.name");
    await expect(
      importPdf(fileOf("form.pdf", new Uint8Array(await formDoc.save()))),
    ).rejects.toThrow(/forms or digital signatures/i);
  });

  it("rejects annotated pages that cannot be preserved safely", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const annotation = doc.context.obj({
      Type: "Annot",
      Subtype: "Text",
      Rect: [0, 0, 10, 10],
      Contents: "note",
    });
    const annotationRef = doc.context.register(annotation);
    page.node.set(PDFName.of("Annots"), doc.context.obj([annotationRef]));
    await expect(
      importPdf(fileOf("annotated.pdf", new Uint8Array(await doc.save()))),
    ).rejects.toThrow(/annotations or signatures/i);
  });

  it("creates exactly two sample PDFs with five distinguishable pages", async () => {
    const samples = await createSamples();
    expect(samples).toHaveLength(2);
    const imported = await Promise.all(samples.map(importPdf));
    expect(imported.map((source) => source.pageCount)).toEqual([2, 3]);
    expect(imported.reduce((sum, source) => sum + source.pageCount, 0)).toBe(5);
    for (const source of imported)
      expect(source.bytes.subarray(0, 5)).toEqual(
        new TextEncoder().encode("%PDF-"),
      );
  });
});
