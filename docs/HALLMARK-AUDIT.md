<!-- Hallmark · pre-emit critique: P4 H4 E4 S5 R5 V4 -->

# PageKit — Hallmark audit

2026-10-03. Applied the globally installed Hallmark 1.1.0 audit verb, its anti-pattern list, and slop-test gates. This report evaluates the current code and rendered interface; it does not modify the website. The scores above assess this audit artifact, not a claim that the page passes Hallmark.

Scope: `src/App.tsx`, `src/styles.css`, and the intro, dialog, and page-card components. The interface reads as a workbench with an editorial marketing introduction. No project-root locked design system or previous Hallmark macrostructure stamp was found; a missing Hallmark stamp is not treated as a retroactive defect in an interface built before this skill was installed.

## Critical

1. **The 3-column feature grid** — `src/App.tsx:755–787`; `src/styles.css:1159–1196`.
   The walkthrough repeats three equal tracks with icon tiles, headings, and short descriptions. It matches Hallmark's named layout tell even though the content describes a useful sequence.
   **Fix:** preserve the steps as a compact sequential row list, with numbers and text inline instead of three equal icon-led columns.

## Major

2. **Eyebrow on every section** — `src/components/LandingIntro.tsx:16–18`; `src/App.tsx:750,803`.
   Three decorative uppercase kickers label the introduction, walkthrough, and limits rather than communicating required ordinal information.
   **Fix:** remove the decorative kickers; let the headings and real step numbers carry hierarchy.

3. **Mid-render token improvisation** — `src/styles.css:170–172,204–215,267–288,1013–1022` and other state/surface rules.
   The root declares shared colors, but many borders, surfaces, hover colors, and shadows still use literal colors farther down the stylesheet. Font and spacing values also lack a fully named token system.
   **Fix:** lift the remaining semantic colors, font roles, and spacing into one token block and consume those tokens throughout.

4. **Wrap-to-two-lines clickable text** — `src/App.tsx:894–940`; `src/styles.css:1404–1455` and the mobile mode-card rules.
   Rendered at 320 px, the export option titles “One organized PDF,” “Split into groups,” and “One PDF per page” occupy two lines. This is an observed Hallmark gate 49 failure, not just a possible overflow.
   **Fix:** stack export choices in one column on narrow screens, keeping each title on one line while allowing its description to wrap.

5. **Input-state gate: uneven heights and collapsing error space** — `src/styles.css:632–653`; `src/App.tsx:960–989`.
   The range input and adjacent action use different size rules below Hallmark's 44 px floor. Filename errors are inserted conditionally without reserving a helper slot, moving the controls below them.
   **Fix:** share a 44 px control-height token, reserve one line for helper/error text, and attach error descriptions and invalid state to the relevant inputs.

## Minor

6. **Tabular data without tabular-nums** — `src/styles.css:537–540,599–607`.
   The step numbers use tabular figures, but source ordinals and workspace counters do not.
   **Fix:** apply `font-variant-numeric: tabular-nums` to numeric counters and ordinal labels.

7. **Hero fit: insufficient bottom-weighted padding** — `src/styles.css:142–149` and responsive intro overrides.
   The main hero's 56 px top / 64 px bottom padding falls below Hallmark's 1.3× bottom-padding rule. Its essential content does fit the tested 1280×800 fold, so this is a rhythm issue rather than clipped content.
   **Fix:** use the spacing scale to increase bottom padding relative to the top without pushing essential content below the fold.

8. **Page-edge clipping safeguard missing** — `src/styles.css:16–23`.
   Neither `html` nor `body` declares the `overflow-x: clip` safeguard required by Hallmark gate 34. The current page has no horizontal overflow at the tested widths.
   **Fix:** add the safeguard and continue measuring child geometry so clipping cannot hide an actual layout regression.

## Verified strengths

- Actual document work drives the page: imports, previews, selection, organization, and exports are functional.
- No invented adoption figures or testimonials, gradient text, fake browser frames, mixed icon libraries, or full-viewport centered hero.
- Controls remain visible without hover; keyboard focus and reduced-motion handling exist.
- The narrow layout fits at 320, 375, 414, and 768 px. Additional 1280 and 1920 px checks also show no horizontal document overflow.
- Primary hero content fits a 1280×800 viewport. Export option wrapping was measured from actual rendered text rectangles.
- Existing browser accessibility checks and independent PDF output checks remain documented in `VERIFICATION.md`; this taste audit does not replace them.

**Verdict:** Hallmark flags a generic supporting-section pattern and incomplete system/state discipline. The useful PDF workspace is worth preserving while addressing the ranked findings.

**Count: 1 critical · 4 major · 3 minor.**

**Resolution, 2026-10-03:** all eight findings were addressed in the subsequent authorized refinement. See [Hallmark refinements](HALLMARK-REFINEMENTS.md) for the changes and verification evidence. The original findings above describe the interface before those changes.
