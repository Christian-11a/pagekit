# PageKit verification

Verified locally on Windows starting on 2026-10-03. The source is published on GitHub, and the website is hosted at https://pagekit-bdy.pages.dev. Physical-phone testing remains pending.

## Live deployment — 2026-10-04

Cloudflare Pages successfully built and deployed the GitHub `main` branch using `npm run build`, output directory `dist`, and Node 24.13.0. Git integration deploys subsequent commits automatically.

On the live HTTPS site in Chrome, sample documents loaded five pages with rendered previews. Page reordering and rotation worked, and the browser downloaded the exported PDF. The download was independently reopened with pypdf: five pages were present, the first page contained the application letter after reordering, and its rotation was 90 degrees. The browser reported no captured console errors. This is a live smoke check, not a repeat of every local browser workflow or a physical-phone check.

## Completed checks

- 20 unit tests passed: PDF validation/export, cached source parsing, arrangements, ranges, and download filenames.
- TypeScript and the Vite production build passed.
- Before the visual redesign, all nine browser scenarios passed in installed Microsoft Edge, installed Chrome, and Playwright Firefox. They cover imports and recovery, scanned pages, editing/history, actual PDF and ZIP downloads, selection and split ranges, keyboard preview navigation, automated accessibility checks, responsive layouts, cancellation, duplicate filenames, and source/page limits.
- Following the final preview sizing and rendering-concurrency changes, production checks passed again in Edge (four scenarios), Chrome (two), and Firefox (two). These include enlarged previews, aspect ratios, keyboard/accessibility checks, and responsive screenshots; Edge also checked PDF/ZIP downloads and scanned images.
- Six downloaded PDFs were independently reopened with pypdf: merged output, selected output, two split outputs, mixed-size/rotated output, and scanned output. Assertions checked page count, expected text/order, rotation, specified dimensions, and retention of the scanned image object.
- Representative merged and scanned exports were rendered with Poppler and visually inspected. Browser screenshots were reviewed at widths 1280, 768, 375, and 320 pixels.
- Browser workflow checks assert no external requests, failed asset responses, or uncaught page errors. Libraries, worker files, PDF.js support assets, and fonts are served locally.

The nine scenarios use synthetic documents rather than private user files. Automated accessibility checks supplement keyboard and layout checks; they do not establish accessibility certification.

## Redesign verification

The replacement interface passed all nine scenarios in Edge across the regression and focused repair runs. Chrome passed the eight import/edit/export/layout scenarios; cancellation and the final dialog changes received separate focused checks. Firefox passed four affected scenarios: empty/mobile accessibility, cancellation and dragging, keyboard dialogs/ranges, and responsive screenshots. The final dialog changes received another focused check. The 20 unit tests and production build also passed.

The standalone design audit reported no horizontal document overflow at eight widths from 320 to 1440 px and no automated accessibility violations in empty desktop and loaded narrow-mobile states. Actual screenshots were inspected, including the desktop walkthrough separately. No runtime libraries were added; the initial JavaScript bundle remains approximately 113 kB gzipped, with the PDF engines loaded when needed. See DESIGN-REVIEW.md for the critique, fixes, and skill-availability note.

## Hallmark refinement verification — 2026-10-03

The production build and all 20 unit tests pass. All 10 workflow cases pass in Edge, including the added regression for aligned controls, attached errors, reserved helper space, and single-line mobile export titles. Chrome passes three focused checks covering the new forms, keyboard dialogs, and responsive layout. Firefox verification is recorded in [HALLMARK-REFINEMENTS.md](HALLMARK-REFINEMENTS.md).

The final design audit measures document and child geometry at ten widths from 320 to 1920 pixels, with no horizontal overflow. Automated accessibility checks report zero violations in empty desktop, loaded mobile, and mobile export states. The four merge/selection/split output files were independently checked again with pypdf; page counts, text, order, and rotation pass. Locally bundled Fraunces was added for display headings; PDF engine code is unchanged.

## Product-first UI verification — 2026-10-04

Production build and 20 unit tests pass. All 11 workflow cases pass in Edge. The two Hallmark form/hero cases plus keyboard-dialog and responsive-layout checks pass in Chrome and Firefox (4 cases each). The new hero test checks local preview images, empty-state accessibility and geometry at 320/375/414/768px, sample importing, the compact editing intro, readable mobile Preview labels, and export availability.

The standalone audit reports no overflowing main-content elements at ten widths from 320 to 1920px and zero automated accessibility violations for empty desktop, loaded mobile, and mobile export states. The sample demonstration fits the 1280×800 fold: its bottom is approximately 561px. Final screenshots were inspected. Independent pypdf checks verify four merged/selected/split downloads again. No PDF engine code changed.

The first full browser run exposed ambiguous selectors after the second sample action was added. Existing tests now target the workspace sample control explicitly, and a separate new case verifies the hero sample control. The corrected full suite passes.

See [DESIGN-INSPIRATION-REVIEW.md](DESIGN-INSPIRATION-REVIEW.md) for the applied reference ideas and current screenshots. Safari, physical devices, and maximum-byte stress coverage remain as described below.

## Reproduce current checks

```sh
npm ci
npm test
npm run build
npm run test:e2e
```

Edge is the default browser. In PowerShell, set `$env:PAGEKIT_TEST_BROWSER='chrome'` to use installed Chrome. For Firefox, install the compatible Playwright browser and set the same variable to `firefox`. Set `PAGEKIT_PRODUCTION=1` to test the built preview instead of the development server. Close an existing server on port 5180 when switching between the two.

`scripts/verify_exports.py` accepts a JSON manifest of downloaded file paths and expected pages. It requires Python and pypdf; these are verification tools, not application dependencies. Browser-download evidence and test reports are generated locally and ignored by Git. Reviewed layout screenshots are in `docs/screenshots/`.

## Remaining limits

- Safari and physical phones have not been tested. Mobile coverage uses resized desktop browser viewports.
- A lightweight 180-page fixture exercises pagination and limits. Maximum byte-size documents and low-memory devices have not undergone stress testing; the 20 MiB/file, 50 MiB total, and 200-page safeguards are not device-performance guarantees.
- Support is for static, unencrypted pages. Detected forms, annotations, and unsupported document-level structures are rejected. Detection is not a complete PDF conformance audit.
- Cancellation prevents stale results from changing the workspace or downloading files. In-progress PDF/ZIP computation may finish internally before its resources are released.
- Refreshing discards the in-memory workspace. Installable offline behavior, public hosting, and live-site verification remain future work.

Use `TEST-WHEN-YOU-WAKE-UP.md` for the first personal testing session.
