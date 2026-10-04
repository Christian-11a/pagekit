import { describe, expect, it } from "vitest";
import { parseSelection, parseSplit } from "./ranges";
import { movePage, pruneSelection, rotatePages } from "./workspace";
import type { WorkspacePage } from "../types";

describe("parseSelection", () => {
  it("expands and sorts one-based ranges", () => {
    expect(parseSelection("5, 1-3", 6)).toEqual([1, 2, 3, 5]);
  });
  it.each(["", "1,,2", "0", "4-2", "1-8", "2, 2", "a"])(
    "rejects invalid input %s",
    (input) => {
      expect(() => parseSelection(input, 6)).toThrow();
    },
  );
  it("rejects an empty workspace", () => {
    expect(() => parseSelection("1", 0)).toThrow(/no pages/i);
  });
});

describe("parseSplit", () => {
  it("preserves requested group order and requires exact coverage", () => {
    expect(parseSplit("1-2; 3, 4", 4)).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(() => parseSplit("1-2; 2-4", 4)).toThrow(/more than one/);
    expect(() => parseSplit("1-2", 4)).toThrow(/Missing: 3-4/);
    expect(() => parseSplit("1-2;;3-4", 4)).toThrow(/semicolons/);
  });
});

const pages: WorkspacePage[] = [0, 1, 2].map((pageIndex) => ({
  id: `s:${pageIndex}`,
  sourceId: "s",
  pageIndex,
  rotation: 0,
}));

describe("workspace arrangement helpers", () => {
  it("moves a page to a clamped target index without mutating input", () => {
    expect(movePage(pages, "s:0", 99).map((page) => page.id)).toEqual([
      "s:1",
      "s:2",
      "s:0",
    ]);
    expect(pages.map((page) => page.id)).toEqual(["s:0", "s:1", "s:2"]);
  });
  it("rotates selected pages in 90 degree increments", () => {
    const rotated = rotatePages(pages, new Set(["s:1"]));
    expect(rotated.map((page) => page.rotation)).toEqual([0, 90, 0]);
    expect(
      rotatePages([{ ...pages[0], rotation: 270 }], new Set(["s:0"]))[0]
        .rotation,
    ).toBe(0);
  });
  it("prunes selection after pages are removed", () => {
    expect(pruneSelection(new Set(["s:0", "stale"]), pages.slice(1))).toEqual(
      new Set(),
    );
  });
});
