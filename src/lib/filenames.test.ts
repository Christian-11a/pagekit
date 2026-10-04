import { describe, it, expect } from "vitest";
import { sanitizeFilename } from "./filenames";
describe("portable download filenames", () => {
  it("preserves Unicode names, strips download suffixes and unsafe characters", () => {
    expect(sanitizeFilename(" Résumé.pdf ")).toBe("Résumé");
    expect(sanitizeFilename("résumé.PDF")).toBe("résumé");
    expect(sanitizeFilename("folder/document:*?")).toBe("folder-document---");
  });
  it("handles reserved Windows names and empty or dot-only input", () => {
    expect(sanitizeFilename("CON.pdf")).toBe("CON-document");
    expect(sanitizeFilename("LPT1")).toBe("LPT1-document");
    expect(sanitizeFilename("...")).toBe("pagekit-document");
    expect(sanitizeFilename(" ", "")).toBe("");
  });
});
