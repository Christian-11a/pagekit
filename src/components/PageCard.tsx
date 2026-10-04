import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  GripVertical,
  RotateCw,
  Trash2,
} from "lucide-react";
import { PagePreview } from "./PagePreview";
import type { SourceDocument, WorkspacePage } from "../types";

export function PageCard({
  page,
  index,
  total,
  source,
  sourceCaption,
  selected,
  dragging,
  dragActive,
  busy,
  onToggle,
  onPreview,
  onRotate,
  onRemove,
  onMove,
  onDragStart,
  onDrop,
}: {
  page: WorkspacePage;
  index: number;
  total: number;
  source?: SourceDocument;
  sourceCaption?: string;
  selected: boolean;
  dragging: boolean;
  dragActive: boolean;
  busy: boolean;
  onToggle: () => void;
  onPreview: () => void;
  onRotate: () => void;
  onRemove: () => void;
  onMove: (to: number) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const [dropTarget, setDropTarget] = useState(false);
  useEffect(() => {
    if (!dragActive) setDropTarget(false);
  }, [dragActive]);
  return (
    <article
      className={`page-card ${selected ? "is-selected" : ""} ${dragging ? "is-being-dragged" : ""} ${dropTarget ? "is-drop-target" : ""}`}
      data-testid="page-card"
      data-page-id={page.id}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("text/plain")) {
          e.preventDefault();
          setDropTarget(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setDropTarget(false);
      }}
      onDrop={(e) => {
        setDropTarget(false);
        onDrop(e);
      }}
    >
      <div className="page-art">
        {page.rotation !== 0 && (
          <span className="rotation-badge">{page.rotation}°</span>
        )}
        <button
          className="thumbnail-preview"
          aria-label={`Enlarge page ${index + 1}`}
          onClick={onPreview}
        >
          {source ? (
            <PagePreview source={source} page={page} />
          ) : (
            <div className="preview-fallback">
              <FileText size={30} />
            </div>
          )}
        </button>
        <span className="page-number">{index + 1}</span>
        <button
          className={`select-mark ${selected ? "checked" : ""}`}
          aria-label={`${selected ? "Deselect" : "Select"} page ${index + 1}`}
          aria-pressed={selected}
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {selected && <Check size={13} strokeWidth={3} />}
        </button>
        <button
          className="drag-handle"
          draggable={!busy}
          aria-label={`Drag page ${index + 1} to reorder`}
          title="Drag to reorder"
          disabled={busy}
          onDragStart={onDragStart}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={17} />
        </button>
      </div>
      <div className="page-meta">
        <div className="page-title">
          <span>Page {index + 1}</span>
          <small>PDF page {page.pageIndex + 1}</small>
        </div>
        <button
          className="preview-button"
          aria-label={`Preview page ${index + 1}`}
          onClick={onPreview}
        >
          Preview
        </button>
      </div>
      <div className="page-source" title={source?.name ?? "PDF source"}>
        {sourceCaption ?? source?.name ?? "PDF source"}
      </div>
      <div
        className="page-actions"
        aria-label={`Actions for page ${index + 1}`}
      >
        <button
          title="Move earlier"
          aria-label={`Move page ${index + 1} earlier`}
          disabled={busy || index === 0}
          onClick={() => onMove(index - 1)}
        >
          <ArrowLeft size={15} />
        </button>
        <button
          title="Move later"
          aria-label={`Move page ${index + 1} later`}
          disabled={busy || index === total - 1}
          onClick={() => onMove(index + 1)}
        >
          <ArrowRight size={15} />
        </button>
        <button
          title="Rotate page"
          aria-label={`Rotate page ${index + 1}`}
          disabled={busy}
          onClick={onRotate}
        >
          <RotateCw size={15} />
        </button>
        <button
          title="Remove page"
          aria-label={`Remove page ${index + 1}`}
          disabled={busy}
          onClick={onRemove}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}
