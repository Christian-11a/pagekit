<!-- Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 -->

# PageKit — Hallmark refinements

2026-10-03. Applied the globally installed Hallmark skill to the existing website. This is a scoped refinement of the working PageKit design. PDF processing and export behavior remain unchanged.

## Design choices

- **Structure:** Workbench, with the real PDF studio as the central interaction. The walkthrough now uses sequential rows alongside its heading.
- **Tone:** calm editorial; the established warm paper and evergreen palette remains.
- **Type:** locally bundled Fraunces for display headings and DM Sans for body text and controls.
- **Enrichment:** retained the existing document illustration; no decorative motion added.
- **System:** root `tokens.css` holds OKLCH colors, font roles, and named 4-point spacing. The stylesheet stamp and `.hallmark/log.json` record this run for future sessions.

## Audit resolutions

| Finding | Implemented change |
| --- | --- |
| Equal three-column icon grid | Replaced with an ordered, vertical walkthrough. |
| Repeated decorative eyebrows | Removed from the introduction, walkthrough, and limits headings. |
| Scattered style values | Centralized semantic color, font, and spacing tokens. |
| Export titles wrapping at 320px | Stacked narrow-screen choices; all four titles remain on one line. |
| Uneven controls and moving errors | Shared 44px control height, reserved helper space, and attached invalid/error descriptions to inputs. Filename and split errors appear after blur; invalid exports remain blocked. |
| Counters without tabular figures | Added tabular numerals to counters and source ordinals. |
| Hero padding rhythm | Increased bottom padding relative to top padding while retaining the visible primary action. |
| Missing page-edge safeguard | Added horizontal clipping and checked actual child geometry to avoid concealing overflow. |

## Verification

- Production build and 20 unit tests pass.
- All 10 browser workflow cases pass in Edge, including the new Hallmark form regression.
- Final typography, mobile layout, form validation, and keyboard-dialog checks pass in Chrome and Firefox (3 focused cases each).
- Firefox initially hit a browser-context cleanup protocol error on the new form case. The isolated rerun passed in 11.4 seconds; the other two cases passed in the initial run.
- No horizontal overflow at 320, 375, 414, 620, 768, 820, 1024, 1280, 1440, or 1920 pixels. Both document width and child boundaries were measured.
- Automated accessibility checks report zero violations for the empty desktop, loaded mobile workspace, and mobile export dialog.
- Reviewed the final desktop and narrow export screenshots. Independently checked exported PDF contents during this refinement; the PDF engine was not changed.

The eight ranked audit findings are resolved. This report records the checks actually performed; it does not claim exhaustive certification of every Hallmark gate or physical-device coverage. Safari and physical-phone checks remain outstanding, as documented in `VERIFICATION.md`.

## Evidence

- [Original audit](HALLMARK-AUDIT.md)
- [Desktop screenshot](screenshots/redesign-desktop.png)
- [Sequential walkthrough](screenshots/redesign-walkthrough.png)
- [Mobile workspace](screenshots/redesign-mobile.png)
- [320px export dialog](screenshots/hallmark-export-320.png)
