import type { WorkspacePage } from "../types";

export const HISTORY_LIMIT = 40;

export function clonePages(pages: WorkspacePage[]): WorkspacePage[] {
  return pages.map((page) => ({ ...page }));
}

export function rotatePages(
  pages: WorkspacePage[],
  selectedIds: Set<string>,
  onlyId?: string,
): WorkspacePage[] {
  return pages.map((page) => {
    if (onlyId ? page.id !== onlyId : !selectedIds.has(page.id)) return page;
    return { ...page, rotation: (((page.rotation + 90) % 360) + 360) % 360 };
  });
}

export function movePage(
  pages: WorkspacePage[],
  id: string,
  targetIndex: number,
): WorkspacePage[] {
  const from = pages.findIndex((page) => page.id === id);
  if (from < 0 || !Number.isFinite(targetIndex)) return pages;
  const to = Math.max(0, Math.min(pages.length - 1, Math.trunc(targetIndex)));
  if (from === to) return pages;
  const next = [...pages];
  const [page] = next.splice(from, 1);
  next.splice(to, 0, page);
  return next;
}

export function pruneSelection(
  selected: Set<string>,
  pages: WorkspacePage[],
): Set<string> {
  const valid = new Set(pages.map((page) => page.id));
  return new Set([...selected].filter((id) => valid.has(id)));
}
