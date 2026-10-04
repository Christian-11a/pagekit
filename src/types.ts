export interface SourceDocument {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  size: number;
}
export interface WorkspacePage {
  id: string;
  sourceId: string;
  pageIndex: number;
  rotation: number;
}
export interface ImportFailure {
  name: string;
  reason: string;
}
export const LIMITS = {
  files: 10,
  fileBytes: 20 * 1024 * 1024,
  totalBytes: 50 * 1024 * 1024,
  pages: 200,
};
