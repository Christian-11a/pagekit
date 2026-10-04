# PageKit: portfolio case study

## Problem

Students and applicants often need to assemble a single submission from separate PDFs. PageKit provides one visual workspace for page order, rotation, removal, and export, with local processing.

## Engineering decisions

Source document bytes remain separate from the page arrangement. Each page has a stable identity, original document/page reference, and rotation delta. That makes page editing inexpensive and allows bounded undo history without duplicating the complete input files for every change.

PDF.js provides previews. A different library, pdf-lib, builds outputs by copying PDF page contents, preserving text on supported static pages instead of turning each page into a screenshot. Preview success is not assumed to prove export success; downloaded PDFs are reopened independently for verification.

The initial release prioritizes static PDFs. Encryption and unsupported interactive/document features produce explanations rather than a promise that every structure will survive. File and page limits bound work; thumbnail rendering is lazy and resources are cleaned up.

Page reordering has explicit controls as well as drag gestures. Page selection and output summaries make export decisions visible. Mobile layouts and keyboard navigation receive separate checks.

## Tradeoffs

Local processing avoids maintaining an upload service, but memory and responsiveness depend on the visitor's device. Conservative limits and progress/cancellation behavior matter more than claiming unlimited support. Refreshing discards the workspace; persistent document storage and installable offline behavior require separate design and testing.

The tool focuses on page assembly. OCR, compression, conversion to Office formats, and redaction would each require additional processing and verification, so they are not bundled into the first release.

## Evidence

See VERIFICATION.md for the actual automated checks, browser environments, output inspection, and remaining device limitations. Extend this case study after gathering feedback from real users.
