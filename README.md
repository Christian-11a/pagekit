# PageKit

A free, open-source workspace for organizing PDF pages. Combine documents, arrange their pages, rotate sideways scans, remove extras, and download the result. Documents are processed in your browser.

[Use PageKit](https://pagekit-bdy.pages.dev) · [Source code and issues](https://github.com/Christian-11a/pagekit) · [MIT license](LICENSE)

## Start locally

On Windows, double-click `START-PAGEKIT.cmd`. Keep its window open while using the app. If port 5180 is already occupied, close the previous PageKit session first.

For other systems, install a supported Node.js release (Node 22.13+ or Node 24 recommended), then run:

```sh
npm ci
npm run dev -- --port 5180
```

Open http://127.0.0.1:5180. The first installation requires internet access; the local app bundles its libraries, worker files, and font. An installable offline app is a future feature.

## Workflow

1. Add PDFs, or try the sample documents.
2. Select, reorder, rotate, and remove pages. Undo and redo page changes.
3. Export the full arrangement, selected pages, range groups, or individual pages.
4. Open your downloaded PDFs to check the result before submitting them anywhere.

Range numbers refer to the current workspace order. Split groups must cover every current page exactly once. For example, a five-page workspace can split into `1-2; 3-5`. Multiple outputs download in a ZIP archive.

## Support and limits

The first release focuses on static, unencrypted PDF pages, including scanned documents. Initial safeguards: 10 files, 20 MiB per file, 50 MiB combined source bytes, and 200 imported pages. These safeguards are not guarantees of performance on every device. Scanned pages are organized as-is; OCR is not included.

PDF structures beyond static page content require special handling. Unsupported interactive or document-level structures are rejected where detected; the app does not promise complete PDF standards compatibility. Encrypted PDFs are unsupported. Export creates a new document and is not a way to preserve digital signature validity, accessibility tags, or archival certification. Read the import error when a document is unsupported.

Documents and filenames stay in local memory; refreshing closes your workspace. No account, backend, analytics, paid API, or document upload is required. Do not assume a smaller output file: this is a page organizer, not a compression tool.

## Development

```sh
npm test
npm run build
npm run test:e2e
```

Browser tests use installed Microsoft Edge by default. Set `PAGEKIT_TEST_BROWSER=chrome` for installed Chrome, or `firefox` with a compatible Playwright Firefox installation. See `docs/VERIFICATION.md` for the actual checks performed and remaining limitations.

Built with React, TypeScript, Vite, PDF.js, pdf-lib, JSZip, Lucide, DM Sans, and Fraunces. Both fonts are bundled locally. PDF.js renders page previews; pdf-lib copies page contents into exports without rasterizing every page. Source bytes remain separate from lightweight page arrangement history.

## Release and contribution

PageKit is available as an open-source project. To deploy, run `npm ci` followed by `npm run build`, then serve the generated `dist/` folder on a static host. PDF.js support assets are copied automatically during the build. No backend or environment secrets are required.

For a bug report, include the browser, operation, and error text. Use a small synthetic PDF that reproduces the issue; do not share private documents. Run the tests and build before submitting changes. Keep new features focused on a demonstrated user problem.

Original code is MIT licensed. See `docs/THIRD-PARTY.md` for dependency licenses.
