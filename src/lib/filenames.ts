/** A portable base filename; downloads append their own PDF or ZIP extension. */
export function sanitizeFilename(
  input: string,
  fallback = "pagekit-document",
): string {
  let cleaned = input
    .trim()
    .replace(/\.(pdf|zip)$/i, "")
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 100)
    .replace(/[.\s]+$/g, "");
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(cleaned))
    cleaned = `${cleaned}-document`;
  return cleaned || fallback;
}
