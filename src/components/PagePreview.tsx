import { useEffect, useRef, useState } from "react";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from "pdfjs-dist/types/src/display/api";
import type { SourceDocument, WorkspacePage } from "../types";
import "./PagePreview.css";

const MAX_CACHED_DOCUMENTS = 10;
const cache = new Map<
  string,
  { task: PDFDocumentLoadingTask; promise: Promise<PDFDocumentProxy> }
>();
const MAX_RENDER_CONCURRENCY = 3;
let activeRenders = 0;
const renderWaiters: Array<() => void> = [];

async function acquireRenderSlot(): Promise<() => void> {
  if (activeRenders >= MAX_RENDER_CONCURRENCY)
    await new Promise<void>((resolve) => renderWaiters.push(resolve));
  else activeRenders += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = renderWaiters.shift();
    if (next) next();
    else activeRenders -= 1;
  };
}

async function getPdf(source: SourceDocument): Promise<PDFDocumentProxy> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  let entry = cache.get(source.id);
  if (!entry) {
    const bytes = new Uint8Array(source.bytes);
    const base = import.meta.env.BASE_URL;
    const task = pdfjs.getDocument({
      data: bytes,
      cMapUrl: new URL(`${base}pdfjs/cmaps/`, document.baseURI).href,
      cMapPacked: true,
      standardFontDataUrl: new URL(
        `${base}pdfjs/standard_fonts/`,
        document.baseURI,
      ).href,
      wasmUrl: new URL(`${base}pdfjs/wasm/`, document.baseURI).href,
    });
    entry = { task, promise: task.promise };
    cache.set(source.id, entry);
    while (cache.size > MAX_CACHED_DOCUMENTS) {
      const [oldestId, oldest] = cache.entries().next().value!;
      cache.delete(oldestId);
      void oldest.task.destroy();
    }
  } else {
    // Map order tracks recency; moving an entry also keeps the cache bounded.
    cache.delete(source.id);
    cache.set(source.id, entry);
  }
  return entry.promise;
}

export function disposePreviews(): void {
  for (const entry of cache.values()) void entry.task.destroy();
  cache.clear();
}

export interface PagePreviewProps {
  source: SourceDocument;
  page: WorkspacePage;
  large?: boolean;
}

/** Lazy PDF.js canvas preview. Set large for the in-app expanded page view. */
export function PagePreview({ source, page, large = false }: PagePreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(large);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hostWidth, setHostWidth] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHostWidth(host.clientWidth));
    observer.observe(host);
    setHostWidth(host.clientWidth);
    return () => observer.disconnect();
  }, [visible, large]);

  useEffect(() => {
    if (large) {
      setVisible(true);
      return;
    }
    const node = hostRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "180px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [large]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    let releaseSlot: (() => void) | undefined;
    let loaded: PDFDocumentProxy | undefined;
    setLoading(true);
    setError(false);
    const paint = async () => {
      try {
        const doc = await getPdf(source);
        loaded = doc;
        if (cancelled) return;
        const pdfPage = await doc.getPage(page.pageIndex + 1);
        if (cancelled) return;
        const host = hostRef.current;
        const canvas = canvasRef.current;
        if (!host || !canvas) return;
        const rotation = (((pdfPage.rotate + page.rotation) % 360) + 360) % 360;
        const base = pdfPage.getViewport({ scale: 1, rotation });
        const width = Math.max(
          1,
          hostWidth || host.clientWidth || (large ? 720 : 220),
        );
        const maxWidth = large ? 1000 : 480;
        const scale = Math.min(width / base.width, maxWidth / base.width, 1.7);
        const viewport = pdfPage.getViewport({ scale, rotation });
        const pixelRatio = Math.min(
          window.devicePixelRatio || 1,
          large ? 2 : 1.5,
        );
        releaseSlot = await acquireRenderSlot();
        if (cancelled) {
          releaseSlot();
          releaseSlot = undefined;
          return;
        }
        canvas.width = Math.ceil(viewport.width * pixelRatio);
        canvas.height = Math.ceil(viewport.height * pixelRatio);
        // Let both dimensions scale together under CSS bounds; fixed dimensions
        // plus max-height would squash portrait pages in thumbnails and dialogs.
        canvas.style.width = "auto";
        canvas.style.height = "auto";
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas unavailable");
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        renderTask = pdfPage.render({
          canvas,
          canvasContext: context,
          viewport,
          background: "#ffffff",
        });
        await renderTask.promise;
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        releaseSlot?.();
        releaseSlot = undefined;
      }
    };
    void paint();
    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        /* already complete */
      }
      releaseSlot?.();
      releaseSlot = undefined;
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        canvas.width = 0;
        canvas.height = 0;
      }
      // Retain a document while the cache owns it; page cleanup releases its operator list.
      void loaded
        ?.getPage(page.pageIndex + 1)
        .then((pdfPage) => pdfPage.cleanup())
        .catch(() => undefined);
    };
  }, [visible, source, page.pageIndex, page.rotation, large, hostWidth]);

  return (
    <div
      className={`page-preview${large ? " page-preview--large" : ""}`}
      ref={hostRef}
      aria-busy={visible && loading && !error}
    >
      {!error && (
        <canvas
          ref={canvasRef}
          aria-label={`${source.name}, page ${page.pageIndex + 1}`}
        />
      )}
      {error && (
        <div
          className="page-preview__error"
          role="img"
          aria-label="Preview unavailable"
        >
          Preview unavailable
        </div>
      )}
    </div>
  );
}

export default PagePreview;
