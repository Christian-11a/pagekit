import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Download,
  FilePlus2,
  Files,
  LoaderCircle,
  LockKeyhole,
  RotateCw,
  Scissors,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  X,
  Redo2,
  FileText,
} from "lucide-react";
import { useWorkspace } from "./hooks/useWorkspace";
import { PagePreview } from "./components/PagePreview";
import { Dialog } from "./components/Dialog";
import { PageCard } from "./components/PageCard";
import { LandingIntro } from "./components/LandingIntro";
import type { SourceDocument, WorkspacePage } from "./types";
import { parseSelection, parseSplit } from "./lib/ranges";
import { sanitizeFilename } from "./lib/filenames";

type ExportMode = "all" | "selected" | "split" | "individual";
type Modal = "export" | "reset" | null;

function splitProblem(value: string, total: number) {
  try {
    parseSplit(value, total);
    return "";
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Check the split page ranges.";
  }
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KiB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

export default function App() {
  const ws = useWorkspace();
  const {
    sources,
    pages,
    selected,
    busy,
    progress,
    message,
    failures,
    canUndo,
    canRedo,
  } = ws;
  const [modal, setModal] = useState<Modal>(null);
  const [exportMode, setExportMode] = useState<ExportMode>("all");
  const [filename, setFilename] = useState("my-organized-pdf");
  const [filenameTouched, setFilenameTouched] = useState(false);
  const [rangesTouched, setRangesTouched] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const [ranges, setRanges] = useState("1-3; 4-8");
  const [previewPage, setPreviewPage] = useState<WorkspacePage | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [rangeInput, setRangeInput] = useState("");
  const [showSources, setShowSources] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [localError, setLocalError] = useState("");
  const [dismissFailures, setDismissFailures] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const focusPage = useRef<string | null>(null);
  const revealWorkspace = useRef(false);
  const [announcement, setAnnouncement] = useState("");
  const [doneMessage, setDoneMessage] = useState("");
  const sourceMap = useMemo(
    () => new Map(sources.map((s) => [s.id, s])),
    [sources],
  );
  const sourceLabel = (source: SourceDocument) => {
    const matches = sources.filter((item) => item.name === source.name);
    return matches.length > 1
      ? `${source.name} · ${matches.findIndex((item) => item.id === source.id) + 1}`
      : source.name;
  };
  const selectedCount = selected.size;
  const rangeError =
    exportMode === "split" && pages.length
      ? splitProblem(ranges, pages.length)
      : "";
  const cleanFilename = sanitizeFilename(filename, "");
  const filenameError = !cleanFilename
    ? "Enter a name for the downloaded file."
    : "";
  const canExport =
    pages.length > 0 &&
    !busy &&
    !filenameError &&
    !rangeError &&
    (exportMode !== "selected" || selectedCount > 0);

  useEffect(() => {
    if (message) setAnnouncement(message);
  }, [message, busy]);
  useEffect(() => {
    setDoneMessage("");
  }, [pages, sources]);
  useEffect(() => {
    if (revealWorkspace.current && pages.length) {
      document.getElementById("workspace")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
      revealWorkspace.current = false;
    }
    if (focusPage.current) {
      const button = document.querySelector(
        `[data-page-id="${CSS.escape(focusPage.current)}"] button`,
      ) as HTMLButtonElement | null;
      if (button) button.focus();
      else addButton.current?.focus();
      focusPage.current = null;
    }
  }, [pages]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const editing = target.matches(
        'input,textarea,select,[contenteditable="true"]',
      );
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "z" &&
        !editing &&
        !modal &&
        !previewPage
      ) {
        e.preventDefault();
        e.shiftKey ? ws.redo() : ws.undo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "y" &&
        !editing &&
        !modal &&
        !previewPage
      ) {
        e.preventDefault();
        ws.redo();
      } else if (
        e.key === "i" &&
        !editing &&
        !e.ctrlKey &&
        !e.metaKey &&
        !busy &&
        !modal &&
        !previewPage
      ) {
        e.preventDefault();
        fileInput.current?.click();
      } else if (e.key === "Escape" && previewPage) setPreviewPage(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [ws, previewPage, busy, modal]);

  const addFiles = (list: FileList | File[]) => {
    setLocalError("");
    setDismissFailures(false);
    setDoneMessage("");
    revealWorkspace.current = true;
    ws.addFiles(Array.from(list));
  };
  const resetWorkspace = () => {
    ws.reset();
    setModal(null);
    setPreviewPage(null);
    setAnnouncement("Workspace cleared.");
  };
  const selectPageRange = () => {
    try {
      parseSelection(rangeInput, pages.length);
      ws.selectRange(rangeInput);
      setSelectionError("");
      setRangeInput("");
      setAnnouncement("Page range selected.");
    } catch (error) {
      setSelectionError(
        error instanceof Error ? error.message : "Check the page range.",
      );
    }
  };
  const movePage = (page: WorkspacePage, to: number) => {
    const i = pages.findIndex((p) => p.id === page.id);
    if (i === to || to < 0 || to >= pages.length) return;
    focusPage.current = page.id;
    ws.movePage(page.id, to);
    setAnnouncement(`Page ${i + 1} moved to position ${to + 1}.`);
  };
  const doExport = async () => {
    if (!canExport) return;
    setDoneMessage("");
    setModal(null);
    try {
      const succeeded = await ws.exportDocument(
        exportMode,
        cleanFilename,
        ranges,
      );
      if (succeeded) {
        setDoneMessage(
          exportMode === "split" || exportMode === "individual"
            ? "Your PDFs are ready in a ZIP file."
            : "Your PDF is ready to download.",
        );
        setAnnouncement("Export complete. Your download has started.");
      }
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "The PDF could not be exported. Try again.",
      );
    }
  };

  const exportLabel =
    exportMode === "all"
      ? "Organized PDF"
      : exportMode === "selected"
        ? "Selected pages"
        : exportMode === "split"
          ? "Split into groups"
          : "One PDF per page";
  const exportCount =
    exportMode === "selected"
      ? selectedCount
      : exportMode === "split"
        ? ranges.split(";").filter(Boolean).length
        : exportMode === "individual"
          ? pages.length
          : 1;

  return (
    <div
      className="app-shell"
      onDragEnd={() => setDragged(null)}
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDropActive(true);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDropActive(false);
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          setDropActive(false);
          addFiles(e.dataTransfer.files);
        }
      }}
    >
      <a href="#workspace" className="skip-link">
        Skip to workspace
      </a>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="PageKit home">
          <span className="brand-mark">
            <Files size={19} />
          </span>
          <span>
            pagekit<span className="brand-dot">.</span>
          </span>
        </a>
        <nav className="top-links" aria-label="Main navigation">
          <span className="nav-current">
            <span className="nav-dot" /> PDF organizer
          </span>
          <a href="#workspace">Workspace</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <div className="top-right">
          <a className="about-link" href="#privacy">
            Privacy
          </a>
        </div>
      </header>

      <main id="top">
        <LandingIntro
          onChoose={() => fileInput.current?.click()}
          onSamples={() => {
            revealWorkspace.current = true;
            ws.loadSamples();
            setAnnouncement("Loading sample PDFs.");
          }}
          busy={busy}
          hasPages={pages.length > 0}
        />

        <section
          className={`workspace ${dropActive ? "drop-active" : ""}`}
          id="workspace"
          aria-label="PDF organizer workspace"
        >
          <div className="workspace-head">
            <div className="workspace-title">
              <span className="workspace-icon">
                <Files size={18} />
              </span>
              <div>
                <h2>The page studio</h2>
                <p>
                  {sources.length
                    ? `${sources.length} PDF${sources.length === 1 ? "" : "s"} · ${pages.length} page${pages.length === 1 ? "" : "s"}`
                    : "Start with your PDFs"}
                </p>
              </div>
            </div>
            <div className="workspace-controls">
              <button
                className="tool-button undo-button"
                disabled={!canUndo || busy}
                onClick={ws.undo}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={15} />
                <span>Undo</span>
              </button>
              <button
                className="tool-button undo-button"
                disabled={!canRedo || busy}
                onClick={ws.redo}
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo2 size={15} />
                <span>Redo</span>
              </button>
              {sources.length > 0 && (
                <button
                  className="quiet-button clear-all-button"
                  disabled={busy}
                  aria-label="Clear all"
                  onClick={() => setModal("reset")}
                >
                  Clear all
                </button>
              )}
              <button
                className="primary small-primary"
                ref={addButton}
                onClick={() => fileInput.current?.click()}
                disabled={busy}
              >
                <FilePlus2 size={16} /> Add PDFs
              </button>
              <input
                ref={fileInput}
                className="sr-only"
                type="file"
                aria-label="Add PDF files"
                accept="application/pdf,.pdf"
                multiple
                onChange={(e) => {
                  if (e.currentTarget.files?.length)
                    addFiles(e.currentTarget.files);
                  e.currentTarget.value = "";
                }}
              />
            </div>
          </div>
          <div className="workspace-body">
            <aside
              className={`source-rail ${showSources ? "source-open" : ""}`}
              aria-label="Source PDFs"
            >
              <button
                className="mobile-source-toggle"
                aria-expanded={showSources}
                aria-controls="source-list"
                onClick={() => setShowSources((v) => !v)}
              >
                <Files size={15} /> Source files ({sources.length}){" "}
                {showSources ? (
                  <ChevronDown size={15} />
                ) : (
                  <ChevronRight size={15} />
                )}
              </button>
              <div className="source-head">
                <span>YOUR FILES</span>
                <span>
                  {sources.length}/{10}
                </span>
              </div>
              {sources.length ? (
                <div className="source-list" id="source-list">
                  {sources.map((source, i) => (
                    <div className="source-item" key={source.id}>
                      <div className="source-file-icon">
                        <FileText size={16} />
                      </div>
                      <div className="source-info">
                        <strong title={source.name}>
                          {sourceLabel(source)}
                        </strong>
                        <small>
                          {source.pageCount} pages · {formatBytes(source.size)}
                        </small>
                      </div>
                      <span className="source-order">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="source-empty" id="source-list">
                  <div className="source-empty-icon">
                    <Files size={17} />
                  </div>
                  <p>
                    Your PDFs
                    <br />
                    will appear here.
                  </p>
                </div>
              )}
              <div className="rail-note">
                <LockKeyhole size={13} />
                <span>
                  Files are processed locally
                  <br />
                  and cleared when you leave.
                </span>
              </div>
            </aside>
            <div className="page-area">
              <div className="page-area-head">
                <div>
                  <h3>
                    Pages <span className="count-pill">{pages.length}</span>
                  </h3>
                  <p>
                    {pages.length
                      ? "Drag pages to reorder, or use the arrow controls."
                      : "Add a PDF to see and arrange its pages."}
                  </p>
                </div>
                {pages.length > 0 && (
                  <div className="page-head-tools">
                    <button
                      className="link-button"
                      disabled={busy}
                      onClick={() =>
                        selectedCount === pages.length
                          ? ws.clearSelection()
                          : ws.selectAll()
                      }
                    >
                      {selectedCount === pages.length
                        ? "Clear selection"
                        : "Select all"}
                    </button>
                  </div>
                )}
              </div>
              {pages.length > 0 && (
                <div
                  className={`selection-bar ${selectedCount ? "has-selection" : ""}`}
                >
                  <label className="range-label" htmlFor="range-select">
                    Select pages
                  </label>
                  <input
                    id="range-select"
                    className="range-input"
                    disabled={busy}
                    value={rangeInput}
                    aria-invalid={Boolean(selectionError)}
                    aria-describedby="selection-help"
                    onChange={(e) => {
                      setRangeInput(e.target.value);
                      setSelectionError("");
                    }}
                    placeholder="e.g. 1-3, 6"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") selectPageRange();
                    }}
                  />
                  <button
                    className="small-outline"
                    onClick={selectPageRange}
                    disabled={busy}
                  >
                    Select
                  </button>
                  {selectedCount > 0 && (
                    <>
                      <span className="selection-count">
                        {selectedCount} selected
                      </span>
                      <div className="selection-actions">
                        <button
                          title="Rotate selected pages"
                          disabled={busy}
                          aria-label="Rotate selected pages"
                          onClick={ws.rotateSelected}
                        >
                          <RotateCw size={15} />
                        </button>
                        <button
                          title="Remove selected pages"
                          disabled={busy}
                          aria-label="Remove selected pages"
                          onClick={() => {
                            const first = pages.findIndex((p) =>
                              selected.has(p.id),
                            );
                            const remaining = pages.filter(
                              (p) => !selected.has(p.id),
                            );
                            focusPage.current =
                              remaining[Math.min(first, remaining.length - 1)]
                                ?.id ?? null;
                            ws.removeSelected();
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </>
                  )}
                  <p
                    id="selection-help"
                    className={`selection-helper ${selectionError ? "field-error" : ""}`}
                    role={selectionError ? "alert" : undefined}
                  >
                    {selectionError ||
                      "Use the current page numbers. Example: 1-3, 6."}
                  </p>
                </div>
              )}
              {pages.length ? (
                <div className={`page-grid ${dragged ? "is-dragging" : ""}`}>
                  {pages.map((page, index) => (
                    <div key={page.id}>
                      <PageCard
                        page={page}
                        dragging={dragged === page.id}
                        dragActive={dragged !== null}
                        index={index}
                        total={pages.length}
                        source={sourceMap.get(page.sourceId)}
                        sourceCaption={
                          sourceMap.has(page.sourceId)
                            ? sourceLabel(sourceMap.get(page.sourceId)!)
                            : undefined
                        }
                        selected={selected.has(page.id)}
                        busy={busy}
                        onToggle={() => ws.toggleSelected(page.id)}
                        onPreview={() => setPreviewPage(page)}
                        onRotate={() => {
                          focusPage.current = page.id;
                          ws.rotatePage(page.id);
                        }}
                        onRemove={() => {
                          focusPage.current =
                            pages[index + 1]?.id ??
                            pages[index - 1]?.id ??
                            null;
                          ws.removePage(page.id);
                        }}
                        onMove={(to) => movePage(page, to)}
                        onDragStart={(e) => {
                          setDragged(page.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", page.id);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from =
                            e.dataTransfer.getData("text/plain") || dragged;
                          if (from) {
                            focusPage.current = from;
                            ws.movePage(from, index);
                          }
                          setDragged(null);
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-visual">
                    <div className="empty-sheet sheet-back">
                      <span />
                      <span />
                    </div>
                    <div className="empty-sheet sheet-front">
                      <FileText size={27} />
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="empty-plus">
                      <Upload size={15} />
                    </div>
                  </div>
                  <h3>Your next PDF starts here</h3>
                  <p>
                    Drop files anywhere in this workspace, or choose them from
                    your device.
                  </p>
                  <button
                    className="primary upload-button"
                    disabled={busy}
                    onClick={() => fileInput.current?.click()}
                  >
                    <Upload size={16} /> Choose PDF files
                  </button>
                  <div className="upload-hints">
                    <span>PDF only</span>
                    <i /> Up to 10 files <i /> 20 MiB each <i /> 50 MiB total
                  </div>
                  <button
                    className="sample-button"
                    data-testid="sample-pdfs"
                    onClick={() => {
                      revealWorkspace.current = true;
                      ws.loadSamples();
                      setAnnouncement("Loading sample PDFs.");
                    }}
                    disabled={busy}
                  >
                    <Sparkles size={14} /> Try sample PDFs
                  </button>
                </div>
              )}
              {!dismissFailures && failures?.length > 0 && (
                <div className="notice error-notice" role="alert">
                  <div>
                    <strong>Some files couldn’t be added</strong>
                    {failures.map((f, i) => (
                      <p key={`${f.name}-${i}`}>
                        <b>{f.name}</b>: {f.reason}
                      </p>
                    ))}
                  </div>
                  <button
                    className="icon-btn"
                    onClick={() => setDismissFailures(true)}
                    aria-label="Dismiss file errors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {localError && (
                <div className="notice error-notice" role="alert">
                  <div>
                    <strong>Check your input</strong>
                    <p>{localError}</p>
                  </div>
                  <button
                    className="icon-btn"
                    onClick={() => setLocalError("")}
                    aria-label="Dismiss error"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {doneMessage && (
                <div className="notice success-notice" role="status">
                  <Check size={17} />
                  <span>{doneMessage}</span>
                  <button
                    className="icon-btn"
                    onClick={() => setDoneMessage("")}
                    aria-label="Dismiss message"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {!busy && message && !doneMessage && (
                <div className="notice info-notice" role="status">
                  <span>{message}</span>
                </div>
              )}
              {busy && (
                <div className="progress-line" role="status" aria-busy="true">
                  <LoaderCircle className="spin" size={15} />
                  <span>{progress || message || "Working on your PDFs…"}</span>
                  <button className="cancel-link" onClick={ws.cancel}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="workspace-foot">
            <span>
              <CircleHelp size={14} />{" "}
              <a href="#limits">Supported files & limits</a>
            </span>
            <span>
              Tip: use <kbd>Ctrl</kbd> + <kbd>Z</kbd> to undo
            </span>
          </div>
          {dropActive && (
            <div className="drop-overlay">
              <div>
                <Upload size={27} />
                <strong>Drop your PDFs here</strong>
                <span>We’ll add them to your workspace.</span>
              </div>
            </div>
          )}
        </section>

        <section className="export-strip">
          <div className="export-copy">
            <span className="export-icon">
              <Download size={18} />
            </span>
            <div>
              <strong>Your next step: a finished PDF.</strong>
              <span>
                {pages.length
                  ? `${pages.length} pages in your final document`
                  : "Arrange your pages, then download your PDF"}
              </span>
            </div>
          </div>
          <button
            className="primary export-button"
            disabled={!pages.length || busy}
            onClick={() => {
              setExportMode("all");
              setModal("export");
            }}
          >
            <Download size={16} /> Export PDF <ArrowRight size={15} />
          </button>
        </section>

        <section className="how-section" id="how-it-works">
          <h2>
            From source files
            <br />
            to a finished PDF.
          </h2>
          <ol className="steps">
            <li>
              <span className="step-num" aria-hidden="true">
                01
              </span>
              <div>
                <h3>Add your files</h3>
                <p>
                  Choose one PDF or bring several together. Your files stay
                  right in your browser.
                </p>
              </div>
            </li>
            <li>
              <span className="step-num" aria-hidden="true">
                02
              </span>
              <div>
                <h3>Arrange your pages</h3>
                <p>
                  Move, rotate, remove, or pull out just the pages you need.
                </p>
              </div>
            </li>
            <li>
              <span className="step-num" aria-hidden="true">
                03
              </span>
              <div>
                <h3>Download and go</h3>
                <p>
                  Export one clean PDF or split your pages into separate files.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <section className="privacy-section" id="privacy">
          <div className="privacy-icon">
            <LockKeyhole size={17} />
          </div>
          <div>
            <strong>Your files stay on this device.</strong>
            <p>
              PageKit works in your browser. PDF contents are not sent to a
              server, and files are cleared when you close or refresh this page.
            </p>
          </div>
        </section>
        <section className="limits-section" id="limits">
          <h2>Made for everyday PDFs.</h2>
          <p>
            Bring static, unencrypted PDFs, including scanned pages. Documents
            with detected forms, annotations, or unsupported document features
            are rejected. Exports create a new PDF; signature validity and
            accessibility tags are not preserved. Scanned pages keep their
            images, without text recognition.
          </p>
          <div className="limit-pills">
            <span>PDF files only</span>
            <span>Up to 10 files</span>
            <span>20 MiB per file</span>
            <span>50 MiB total</span>
            <span>Up to 200 pages</span>
          </div>
        </section>
        <footer className="footer">
          <a className="brand footer-brand" href="#top">
            <span className="brand-mark">
              <Files size={17} />
            </span>
            <span>
              pagekit<span className="brand-dot">.</span>
            </span>
          </a>
          <span>Simple tools for everyday PDFs.</span>
          <a href="#privacy">Privacy first</a>
          <a href="https://github.com/Christian-11a/pagekit" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <span>
            PageKit ·{" "}
            <a href="/LICENSE.txt" target="_blank" rel="noreferrer">
              MIT license
            </a>
          </span>
        </footer>
      </main>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {previewPage && (
        <Dialog
          title={`Page ${pages.findIndex((p) => p.id === previewPage.id) + 1} preview`}
          description={sourceMap.get(previewPage.sourceId)?.name}
          onClose={() => setPreviewPage(null)}
          labelledBy="preview-title"
        >
          <div className="large-preview">
            {sourceMap.get(previewPage.sourceId) && (
              <PagePreview
                source={sourceMap.get(previewPage.sourceId)!}
                page={previewPage}
                large
              />
            )}
          </div>
          <div className="preview-footer">
            <span>PDF page {previewPage.pageIndex + 1}</span>
            <div>
              <button
                className="small-outline"
                onClick={() => {
                  const i = pages.findIndex((p) => p.id === previewPage.id);
                  if (i > 0) setPreviewPage(pages[i - 1]);
                }}
                disabled={pages.findIndex((p) => p.id === previewPage.id) <= 0}
              >
                <ArrowLeft size={14} /> Previous
              </button>
              <button
                className="small-outline"
                onClick={() => {
                  const i = pages.findIndex((p) => p.id === previewPage.id);
                  if (i < pages.length - 1) setPreviewPage(pages[i + 1]);
                }}
                disabled={
                  pages.findIndex((p) => p.id === previewPage.id) >=
                  pages.length - 1
                }
              >
                Next <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {modal === "export" && (
        <Dialog
          title="Your PDF, ready to go."
          description="Choose what you’d like to download. You can review everything before exporting."
          onClose={() => setModal(null)}
          labelledBy="export-title"
        >
          <div className="export-modal-content">
            <div className="export-summary">
              <div className="summary-icon">
                <Files size={19} />
              </div>
              <div>
                <strong>
                  {sources.length} source{sources.length === 1 ? "" : "s"} ·{" "}
                  {pages.length} pages
                </strong>
                <span>Current workspace order is used.</span>
              </div>
            </div>
            <label className="field-label" htmlFor="export-mode">
              Download as
            </label>
            <div className="export-mode-grid" id="export-mode">
              {(
                [
                  ["all", "One organized PDF", "Combine all workspace pages"],
                  ["selected", "Selected pages", "Create a PDF from selection"],
                  [
                    "split",
                    "Split into groups",
                    "Download range groups as a ZIP",
                  ],
                  [
                    "individual",
                    "One PDF per page",
                    "Download every page separately",
                  ],
                ] as [ExportMode, string, string][]
              ).map(([mode, title, sub]) => (
                <button
                  key={mode}
                  className={`mode-card ${exportMode === mode ? "active" : ""}`}
                  onClick={() => setExportMode(mode)}
                  aria-pressed={exportMode === mode}
                >
                  <span className="mode-radio" />
                  {mode === "split" || mode === "individual" ? (
                    <Scissors size={16} />
                  ) : (
                    <Files size={16} />
                  )}
                  <span>
                    <strong>{title}</strong>
                    <small>{sub}</small>
                  </span>
                </button>
              ))}
            </div>
            <label className="field-label" htmlFor="filename">
              File name
            </label>
            <div className="filename-field">
              <input
                id="filename"
                aria-required="true"
                aria-invalid={filenameTouched && Boolean(filenameError)}
                aria-describedby="filename-help"
                onBlur={() => setFilenameTouched(true)}
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                maxLength={90}
                placeholder="my-organized-pdf"
              />
              <span>
                {exportMode === "split" || exportMode === "individual"
                  ? ".zip"
                  : ".pdf"}
              </span>
            </div>
            <p
              id="filename-help"
              className={`field-helper ${filenameTouched && filenameError ? "field-error" : ""}`}
              role={filenameTouched && filenameError ? "alert" : undefined}
            >
              {filenameTouched && filenameError
                ? filenameError
                : "Choose a name for your download."}
            </p>
            {exportMode === "split" && (
              <>
                <label className="field-label" htmlFor="ranges">
                  Page ranges <span>Use semicolons to separate files</span>
                </label>
                <input
                  className="full-input"
                  id="ranges"
                  aria-required="true"
                  aria-invalid={rangesTouched && Boolean(rangeError)}
                  aria-describedby="ranges-help"
                  onBlur={() => setRangesTouched(true)}
                  value={ranges}
                  onChange={(e) => setRanges(e.target.value)}
                  placeholder="1-3; 4-8"
                />
                <p
                  id="ranges-help"
                  className={`range-help ${rangesTouched && rangeError ? "field-error" : ""}`}
                  role={rangesTouched && rangeError ? "alert" : undefined}
                >
                  {(rangesTouched && rangeError) ||
                    "Separate files with semicolons. Include every current page exactly once."}
                </p>
              </>
            )}
            {exportMode === "selected" && selectedCount === 0 && (
              <p className="field-error" role="alert">
                Select at least one page in the workspace first.
              </p>
            )}
            <div className="final-summary">
              <span className="summary-check">
                <Check size={14} />
              </span>
              <div>
                <strong>{exportLabel}</strong>
                <span>
                  {exportMode === "all"
                    ? `1 PDF · ${pages.length} pages`
                    : exportMode === "selected"
                      ? `1 PDF · ${selectedCount} selected pages`
                      : exportMode === "individual"
                        ? `${pages.length} PDFs in 1 ZIP`
                        : `${Math.max(0, ranges.split(";").filter((group) => group.trim()).length)} PDFs in 1 ZIP`}
                </span>
              </div>
              <span className="local-only">
                <LockKeyhole size={12} /> Local
              </span>
            </div>
            <div className="modal-actions">
              <button className="quiet-button" onClick={() => setModal(null)}>
                Keep editing
              </button>
              <button
                className="primary"
                onClick={doExport}
                disabled={!canExport}
              >
                <Download size={15} /> Download{" "}
                {exportMode === "split" || exportMode === "individual"
                  ? "ZIP"
                  : "PDF"}
              </button>
            </div>
            <p className="modal-private">
              <LockKeyhole size={12} /> Your document stays on this device.
            </p>
          </div>
        </Dialog>
      )}
      {modal === "reset" && (
        <Dialog
          title="Clear this workspace?"
          description="This removes your PDFs and all page changes from the current session."
          onClose={() => setModal(null)}
          labelledBy="reset-title"
        >
          <div className="reset-content">
            <p>
              You can’t undo clearing the complete workspace. Your original
              files on your device won’t be changed.
            </p>
            <div className="modal-actions">
              <button className="quiet-button" onClick={() => setModal(null)}>
                Keep workspace
              </button>
              <button className="danger-button" onClick={resetWorkspace}>
                <Trash2 size={15} /> Clear workspace
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
