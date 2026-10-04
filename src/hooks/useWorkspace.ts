import { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import type { ImportFailure, SourceDocument, WorkspacePage } from "../types";
import { LIMITS } from "../types";
import { parseSelection, parseSplit } from "../lib/ranges";
import {
  clonePages,
  HISTORY_LIMIT,
  movePage as moveArrangementPage,
  pruneSelection,
  rotatePages,
} from "../lib/workspace";
import { disposePreviews } from "../components/PagePreview";
import { sanitizeFilename } from "../lib/filenames";
export { sanitizeFilename } from "../lib/filenames";

type ExportMode = "all" | "selected" | "split" | "individual";
type Snapshot = WorkspacePage[];

// Load document tooling only when a visitor starts working with PDFs.
const importPdf = async (file: File) =>
  (await import("../lib/pdf")).importPdf(file);
const createSamples = async () => (await import("../lib/pdf")).createSamples();
const createPdfExporter = async (sources: SourceDocument[]) =>
  (await import("../lib/pdf")).createPdfExporter(sources);

function makeId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `page-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function pageId(sourceId: string, pageIndex: number): string {
  return `${sourceId}:${pageIndex}`;
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function useWorkspace() {
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [pages, setPages] = useState<WorkspacePage[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  const [failures, setFailures] = useState<ImportFailure[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const operation = useRef(0);
  const busyLock = useRef(false);

  useEffect(
    () => () => {
      operation.current += 1;
      busyLock.current = false;
      disposePreviews();
    },
    [],
  );

  const syncHistoryState = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const setArrangement = useCallback(
    (next: WorkspacePage[], record = true) => {
      if (next === pages) return;
      if (record) {
        undoStack.current = [...undoStack.current, clonePages(pages)].slice(
          -HISTORY_LIMIT,
        );
        redoStack.current = [];
        syncHistoryState();
      }
      setPages(next);
      setSelected((currentSelected) => pruneSelection(currentSelected, next));
    },
    [pages, syncHistoryState],
  );

  const start = useCallback((label: string) => {
    const token = ++operation.current;
    busyLock.current = true;
    setBusy(true);
    setProgress(label);
    setMessage(label);
    return token;
  }, []);

  const isCurrent = useCallback(
    (token: number) => operation.current === token,
    [],
  );

  const finish = useCallback(
    (token: number) => {
      if (!isCurrent(token)) return;
      busyLock.current = false;
      setBusy(false);
      setProgress("");
    },
    [isCurrent],
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      if (busyLock.current || files.length === 0) return;
      const token = start("Checking PDF files…");
      const nextSources: SourceDocument[] = [];
      const nextPages: WorkspacePage[] = [];
      const nextFailures: ImportFailure[] = [];
      let bytesUsed = sources.reduce((sum, source) => sum + source.size, 0);
      let pageCount = sources.reduce(
        (sum, source) => sum + source.pageCount,
        0,
      );
      let sourceCount = sources.length;

      for (const file of files) {
        if (!isCurrent(token)) return;
        const fail = (reason: string) =>
          nextFailures.push({ name: file.name, reason });
        if (sourceCount >= LIMITS.files) {
          fail(`The workspace supports up to ${LIMITS.files} PDF files.`);
          continue;
        }
        if (file.size === 0) {
          fail("This file is empty.");
          continue;
        }
        if (file.size > LIMITS.fileBytes) {
          fail("This file is larger than 20 MiB.");
          continue;
        }
        if (bytesUsed + file.size > LIMITS.totalBytes) {
          fail("Adding this file would exceed the 50 MiB workspace limit.");
          continue;
        }
        const extensionLooksPdf = /\.pdf$/i.test(file.name);
        const typeLooksPdf = !file.type || file.type === "application/pdf";
        if (!extensionLooksPdf && !typeLooksPdf) {
          fail("Choose a PDF file.");
          continue;
        }
        setProgress(`Reading ${file.name}…`);
        setMessage(`Reading ${file.name}…`);
        try {
          const parsed = await importPdf(file);
          if (!isCurrent(token)) return;
          if (pageCount + parsed.pageCount > LIMITS.pages) {
            fail(
              `Adding this file would exceed the ${LIMITS.pages}-page workspace limit.`,
            );
            continue;
          }
          const id = makeId();
          const source = { ...parsed, id, name: file.name, size: file.size };
          nextSources.push(source);
          for (
            let pageIndex = 0;
            pageIndex < source.pageCount;
            pageIndex += 1
          ) {
            nextPages.push({
              id: pageId(id, pageIndex),
              sourceId: id,
              pageIndex,
              rotation: 0,
            });
          }
          sourceCount += 1;
          bytesUsed += file.size;
          pageCount += source.pageCount;
        } catch (error) {
          if (!isCurrent(token)) return;
          fail(
            error instanceof Error
              ? error.message
              : "This PDF could not be read.",
          );
        }
      }

      if (!isCurrent(token)) return;
      if (nextSources.length) {
        setSources((current) => [...current, ...nextSources]);
        setArrangement([...pages, ...nextPages], false);
        undoStack.current = [];
        redoStack.current = [];
        syncHistoryState();
        setSelected(new Set());
        setMessage(
          `${nextSources.length} PDF${nextSources.length === 1 ? "" : "s"} added${nextFailures.length ? `; ${nextFailures.length} skipped` : ""}.`,
        );
      } else if (nextFailures.length) {
        setMessage("No PDFs were added. Review the file messages below.");
      }
      setFailures(nextFailures);
      finish(token);
    },
    [
      busy,
      finish,
      isCurrent,
      pages,
      setArrangement,
      sources,
      start,
      syncHistoryState,
    ],
  );

  const loadSamples = useCallback(async () => {
    if (busyLock.current) return;
    const token = start("Preparing sample PDFs…");
    try {
      const sampleFiles = await createSamples();
      if (isCurrent(token)) {
        finish(token);
        await addFiles(sampleFiles);
      }
    } catch (error) {
      if (isCurrent(token)) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Sample PDFs could not be prepared.",
        );
        finish(token);
      }
    }
  }, [addFiles, finish, isCurrent, start]);

  const toggleSelected = useCallback(
    (id: string) => {
      if (busyLock.current) return;
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else if (pages.some((page) => page.id === id)) next.add(id);
        return next;
      });
    },
    [pages],
  );
  const selectAll = useCallback(() => {
    if (!busyLock.current) setSelected(new Set(pages.map((page) => page.id)));
  }, [pages]);
  const clearSelection = useCallback(() => {
    if (!busyLock.current) setSelected(new Set());
  }, []);
  const selectRange = useCallback(
    (input: string) => {
      if (busyLock.current) return;
      try {
        const numbers = parseSelection(input, pages.length);
        setSelected(new Set(numbers.map((number) => pages[number - 1].id)));
        setMessage(
          `${numbers.length} page${numbers.length === 1 ? "" : "s"} selected.`,
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "That page range is invalid.",
        );
      }
    },
    [pages],
  );

  const rotateSelected = useCallback(() => {
    if (busyLock.current || !selected.size) return;
    setArrangement(rotatePages(pages, selected));
    setMessage(
      `${selected.size} page${selected.size === 1 ? "" : "s"} rotated.`,
    );
  }, [pages, selected, setArrangement]);
  const rotatePage = useCallback(
    (id: string) => {
      if (busyLock.current) return;
      setArrangement(rotatePages(pages, new Set(), id));
      setMessage("Page rotated.");
    },
    [pages, setArrangement],
  );
  const removeSelected = useCallback(() => {
    if (busyLock.current || !selected.size) return;
    setArrangement(pages.filter((page) => !selected.has(page.id)));
    setMessage(
      `${selected.size} page${selected.size === 1 ? "" : "s"} removed from the output.`,
    );
  }, [pages, selected, setArrangement]);
  const removePage = useCallback(
    (id: string) => {
      if (busyLock.current) return;
      setArrangement(pages.filter((page) => page.id !== id));
      setMessage("Page removed from the output.");
    },
    [pages, setArrangement],
  );
  const movePage = useCallback(
    (id: string, targetIndex: number) => {
      if (busyLock.current) return;
      setArrangement(moveArrangementPage(pages, id, targetIndex));
    },
    [pages, setArrangement],
  );

  const undo = useCallback(() => {
    if (busyLock.current) return;
    const snapshot = undoStack.current.pop();
    if (!snapshot) return;
    redoStack.current = [...redoStack.current, clonePages(pages)].slice(
      -HISTORY_LIMIT,
    );
    setArrangement(clonePages(snapshot), false);
    syncHistoryState();
    setMessage("Change undone.");
  }, [pages, setArrangement, syncHistoryState]);
  const redo = useCallback(() => {
    if (busyLock.current) return;
    const snapshot = redoStack.current.pop();
    if (!snapshot) return;
    undoStack.current = [...undoStack.current, clonePages(pages)].slice(
      -HISTORY_LIMIT,
    );
    setArrangement(clonePages(snapshot), false);
    syncHistoryState();
    setMessage("Change restored.");
  }, [pages, setArrangement, syncHistoryState]);

  const reset = useCallback(() => {
    operation.current += 1;
    busyLock.current = false;
    setBusy(false);
    setProgress("");
    setSources([]);
    setPages([]);
    setSelected(new Set());
    setFailures([]);
    disposePreviews();
    setMessage("Workspace cleared.");
    undoStack.current = [];
    redoStack.current = [];
    syncHistoryState();
  }, [syncHistoryState]);
  const cancel = useCallback(() => {
    operation.current += 1;
    busyLock.current = false;
    setBusy(false);
    setProgress("");
    setMessage("Operation cancelled. Your workspace is unchanged.");
  }, []);

  const byteBlob = (bytes: Uint8Array) =>
    new Blob([new Uint8Array(bytes).buffer], { type: "application/pdf" });

  const exportDocument = useCallback(
    async (
      mode: ExportMode,
      filename: string,
      ranges: string,
    ): Promise<boolean> => {
      if (busyLock.current || pages.length === 0) return false;
      const orderedSelected = pages.filter((page) => selected.has(page.id));
      let groups: WorkspacePage[][];
      if (mode === "selected") {
        if (!orderedSelected.length) {
          setMessage("Select at least one page to export.");
          return false;
        }
        groups = [orderedSelected];
      } else if (mode === "split") {
        try {
          groups = parseSplit(ranges, pages.length).map((group) =>
            group.map((position) => pages[position - 1]),
          );
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "Check the split ranges.",
          );
          return false;
        }
      } else if (mode === "individual") {
        groups = pages.map((page) => [page]);
      } else {
        groups = [pages];
      }
      const base = sanitizeFilename(filename);
      const token = start("Preparing your PDF…");
      try {
        const zip =
          mode === "split" || mode === "individual" ? new JSZip() : undefined;
        const exportPdf = await createPdfExporter(sources);
        for (let index = 0; index < groups.length; index += 1) {
          if (!isCurrent(token)) return false;
          setProgress(
            groups.length > 1
              ? `Preparing PDF ${index + 1} of ${groups.length}…`
              : "Preparing your PDF…",
          );
          const bytes = await exportPdf(groups[index]);
          if (!isCurrent(token)) return false;
          const pdfName =
            mode === "individual"
              ? `${base}-page-${index + 1}.pdf`
              : mode === "split"
                ? `${base}-part-${String(index + 1).padStart(2, "0")}.pdf`
                : `${base}.pdf`;
          if (zip) zip.file(pdfName, bytes);
          else download(byteBlob(bytes), pdfName);
        }
        if (zip) {
          setProgress("Packing your download…");
          setMessage("Packing your download…");
          const blob = await zip.generateAsync({ type: "blob" });
          if (!isCurrent(token)) return false;
          download(blob, `${base}.zip`);
        }
        if (!isCurrent(token)) return false;
        setMessage(
          mode === "individual"
            ? `${pages.length} individual PDFs downloaded in a ZIP.`
            : mode === "split"
              ? `${groups.length} PDFs downloaded in a ZIP.`
              : "PDF downloaded.",
        );
        return true;
      } catch (error) {
        if (isCurrent(token))
          setMessage(
            error instanceof Error
              ? error.message
              : "The PDF could not be exported.",
          );
        return false;
      } finally {
        finish(token);
      }
    },
    [finish, isCurrent, pages, selected, sources, start],
  );

  return {
    sources,
    pages,
    selected,
    busy,
    progress,
    message,
    failures,
    canUndo,
    canRedo,
    addFiles,
    loadSamples,
    toggleSelected,
    selectAll,
    clearSelection,
    selectRange,
    rotateSelected,
    rotatePage,
    removeSelected,
    removePage,
    movePage,
    undo,
    redo,
    reset,
    exportDocument,
    cancel,
  };
}
