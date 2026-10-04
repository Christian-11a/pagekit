/** Parse one-based page selections such as "1, 3-5". */
export function parseSelection(input: string, total: number): number[] {
  assertTotal(total);
  const tokens = input.split(",").map((part) => part.trim());
  if (!input.trim() || tokens.some((token) => !token)) {
    throw new Error("Enter page numbers or ranges, such as 1, 3-5.");
  }

  const selected = new Set<number>();
  for (const token of tokens) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(token);
    if (!match)
      throw new Error(`“${token}” is not a valid page number or range.`);
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < 1) throw new Error("Page numbers must start at 1.");
    if (start > end) throw new Error(`Range ${token} is reversed.`);
    if (end > total)
      throw new Error(`Page ${end} is outside the workspace (1–${total}).`);
    for (let page = start; page <= end; page += 1) {
      if (selected.has(page))
        throw new Error(`Page ${page} appears more than once.`);
      selected.add(page);
    }
  }
  return [...selected].sort((a, b) => a - b);
}

/** Parse semicolon-separated groups and require every page exactly once. */
export function parseSplit(input: string, total: number): number[][] {
  assertTotal(total);
  const groups = input.split(";").map((group) => group.trim());
  if (!input.trim() || groups.some((group) => !group)) {
    throw new Error(
      "Separate split groups with semicolons, for example 1-3; 4-8.",
    );
  }
  const parsed = groups.map((group) => parseSelection(group, total));
  const seen = new Set<number>();
  for (const group of parsed) {
    for (const page of group) {
      if (seen.has(page))
        throw new Error(`Page ${page} appears in more than one split group.`);
      seen.add(page);
    }
  }
  const missing = Array.from({ length: total }, (_, index) => index + 1).filter(
    (page) => !seen.has(page),
  );
  if (missing.length)
    throw new Error(
      `Split groups must include every page. Missing: ${compress(missing)}.`,
    );
  return parsed;
}

function assertTotal(total: number): void {
  if (!Number.isSafeInteger(total) || total < 1)
    throw new Error("There are no pages to organize.");
}

function compress(pages: number[]): string {
  const runs: string[] = [];
  for (let index = 0; index < pages.length;) {
    let end = index;
    while (end + 1 < pages.length && pages[end + 1] === pages[end] + 1)
      end += 1;
    runs.push(
      end === index ? `${pages[index]}` : `${pages[index]}-${pages[end]}`,
    );
    index = end + 1;
  }
  return runs.join(", ");
}
