# UI/UX polish — 2026-10-22

## Purpose and boundaries

User request:「このアプリのUIUXを100点で評価し、より見た目が良く使いやすいものにブラシュアップ 丁寧に計画し実行して」

Improve visual hierarchy, comparison, reading and mobile operation across the existing app. Local implementation is authorized; production publishing needs a separate explicit approval. Keep all data, calculations, filters, mode separation, personal/cloud storage and URL contracts. Reuse the current checkout; no app copy or new dependency.

The existing specification is `../specs/2026-08-07-uiux-refined-plan.md`; this plan records the October extension. The list remains visible alongside detail on desktop. All four object types, nearby navigation, school comparison, the four primary dining filters, 75-point meaning/evidence, and record management remain available.

## Measured baseline and score

Baseline: e44b52d, Chrome at 1500×769 and 390×844. The following is an evidence-based design judgment, not an objective benchmark or a full accessibility certification.

| Axis | Before | Evidence |
|---|---:|---|
| Simplicity and visual hierarchy | 15/20 | Consistent map/list structure; small and dense controls compete for attention. |
| Information fit and readability | 13/20 | Desktop detail 300px wide, body 12px, labels 11px; Kanbe detail scroll height 1456px in 669px viewport. |
| Actions and continuity | 14/20 | Six representative journeys work; school age 8 becomes comparison age 5 and requires correction. |
| Device and use context | 8/15 | Mobile expanded legend overlaps 207.7px of list; expanded filters leave only 16px of list; detail extends 72px into the list area. |
| Accessibility | 10/15 | Many desktop controls 24–30px high and mobile checkboxes 24px; project mobile target is 40px. Existing keyboard/card semantics are useful. |
| Consistency and restraint | 8/10 | Shared tokens and clear modes; detail/list sizing and density need alignment. |
| **Total** | **68/100** | Re-score with the same weights after measured verification. |

Baseline screenshots are in `C:/Users/takem/.work/mont-kiara-review/ui-before-*.png` (temporary, not committed).

## Alternatives and decision

A: preserve desktop map + left detail + right list; widen reading panes selectively, tighten hierarchy and remove mobile collisions. B: replace the right list with detail. Independent alternative review preferred A because B adds back-navigation and removes simultaneous comparison. Adopt A. Do not enlarge every font/control uniformly: restaurant cards currently measure about 127px, and retaining scan density matters.

Use a restrained blue/ink/white palette, strong primary text, clearer secondary text, consistent rounded cards and subtle elevation. No decorative hero, external font or stock imagery. Typography: compact list metadata remains 12–13px; detail body becomes 14px with 1.7 line height. Desktop list approximately 400px and detail 360px when space allows; retain usable map on narrower screens.

Mobile: keep map/list split by default; expand the list region while filters are open so both conditions and at least one result remain usable. Anchor the legend inside the map region. Detail uses the available content area with an obvious close control and independently scrollable body. Restore focus when leaving detail. Do not change the underlying navigation/state contracts.

School comparison inherits a valid selected school-filter age on opening. If there is no selected age or age is outside its existing 3–17 range (e.g. 18), retain the comparison's selected age. Preserve published-fee-only calculations and the visible comparison age selector.

## Execution

1. Record behavioral regressions first. Add meaningful unit/contract coverage for age inheritance and any new overlay/resize behavior. Observe failures before implementation. Appearance-only adjustments use actual screenshots and geometry, not implementation-mirroring tests.
2. Update existing tokens/rules in `index.html`; consolidate affected duplicates. Shared widths position map controls consistently. Update the mobile block and relevant UI handlers together. Render a local candidate in the real app before accepting the layout.
3. Verify representative journeys and edge cases below, adjust the candidate, run `npm test`, and perform independent adversarial review. Fix material findings, then synchronize the existing UI spec, code map and project record. Save evidence and re-score honestly.

Pre-flight: CSS panel height and map sizing share the mobile filter-open state; map invalidation must follow the final geometry. Detail visibility, close behavior and keyboard focus share the selected-record state; do not create a competing selection store. School age synchronization must not modify the fee engine.

## Acceptance / verification

- Desktop 1500px; mobile 390px plus 320px narrow and 844×390 short landscape. No horizontal document overflow; legend stays in map bounds; at 390×844 and 320px width, expanded filters leave one full first result card visible, with its top and bottom inside the list viewport. Filter scrolling alone does not meet this condition. A sticky close action returns to results in one action.
- 769–1199px uses 336px list and 320px detail, preserving at least 180px of map at 844px including detail inset. Verify the close control restores the full map and the list remains available in short landscape.
- Read real long condo/school/commercial/dining detail including nearby and evidence. Text wraps; close and primary actions remain reachable. Mobile foreground detail must not leave hidden background controls keyboard-accessible.
- Six journeys: housing area/rent/sort→detail→nearby school; age 8→school comparison→nearby condo; commercial search→detail; dining category/budget→Kanbe→evidence; record management entry→return (no real write/delete/login); empty search→clear→share→reload.
- Keyboard open/close/focus; 390→844px rotation while detail is open; nearby reselect→Escape; URL direct-open→close. Resolve return focus by record name after list redraw; fall back to search when the card is unavailable. CSS visibility reverses background isolation at the desktop breakpoint. Check mobile touch sizes on changed controls and sampled text contrast (4.5:1 normal text). Sources: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html and https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html . Project 40px mobile target is stricter than the general 24px minimum.
- Preserve numeric contents, unknown-value labels, ranking, primary dining filters, personal-data separation and URL restoration. `npm test` is the mandatory repository gate. No build step for static Pages.
- Independent review: at least three attacks (filter crowding, navigation/focus, hidden mode/record regression) and two extremes (320px, short landscape/long content). Reviewer receives artifacts and criteria, not implementation rationale.

## Execution record

- Baseline: all six journeys inspected; shared Kanbe search restored exactly one result after reload (confirmed 2026-10-22). Root causes: viewport-bottom legend positioning, filters consuming fixed mobile panel height, and separate age selectors without synchronization.
- Rule application: current common/repository rules and applicable improvement, inheritance, production standards and bugfix sources read. User's instruction to plan and execute authorizes local changes. Existing checkout is used under the common no-duplicate rule; no implementation workers are involved. Visual changes use browser evidence, behavioral fixes use RED→GREEN. No publication authorized.
- Plan review: independent judge accepted A over B and the score arithmetic, required stricter result visibility, intermediate-width layout and focus/rotation checks. All three conditions incorporated above. Reviewer did not certify browser execution.
- Implementation in progress: token/rule updates in place; school age tests observed 3 failures then passed all 5; focus-return tests observed 2 failures then passed. Targeted suite 84/84 passed. Mobile candidate detail measured 734px high, 14px body, covered background hidden; Escape returns to the Kanbe card. Filter candidate initially left 144px for a 159px card; increased mobile result minimum to 192px before acceptance.
- Final local candidate: all six journeys completed. Housing area/rent/sort still gives 39 results; school filter age 8 opens comparison at 8; commercial detail/nearby, dining evidence, data-management entry/return, empty search recovery and shared Kanbe search reload work. No real personal record was written, deleted or used for authentication testing.
- Additional lifecycle fixes found in the walk: switching mode or entering data management closes the old detail; selecting another record resets detail scroll; close resolves focus against the newly rendered list. Independent final review found redraw-focus loss, reproduced with a DOM-replacement harness (2 failures before correction). Focus now follows the same action or the detail container; active memo/amount entry is preserved. Collapsed-list focus was also reproduced in Chrome (hidden card y806 inside panel height 0), corrected and verified to return to `toggleBtn`.
- Final geometry: 1500×769 list 400px/detail 360px, prose 14px (previously 336/300/12); restaurant card remains 127px tall on desktop. Mobile detail at 390×844 is 734px high. After transition, visible interactive background controls inside the content area are 0. Header mode/data-management actions remain available by design.
- Mobile filters: the initial 192px result region could not fully contain the 193.9px Fairview Penang school card at 320px width. The final shared mobile minimum is 224px. Its top and bottom now fit with filters both expanded and collapsed. At 390px, Kanbe also fits; expanded legend/list overlap is 0px (before 207.7px). Filters have their own scrolling and a sticky close action. The detail pane and app have no horizontal overflow at 320, 390, 844 and 1500px.
- Rotation/short landscape: 844×390 uses 336px list, 320px detail and 180px of unobscured map between them. Background visibility returns on desktop; Escape restores the selected school card. Nearby→Escape and direct URL→close were also walked. Search/share reload restores the single Kanbe result.
- Contrast samples from current tokens: primary/white 14.70:1, secondary/white 6.25:1, accent/white 6.85:1, secondary/background 5.74:1. Changed mobile checkboxes, layer buttons, zoom and detail-close controls use the project's 40px target. These are selected checks, not a full WCAG certification.
- Verification: full suite **29 files / 811 tests passed** (2026-10-22 13:52 local runtime, 1.48s). After the final CSS-only mobile minimum adjustment, all **99 affected layout/accessibility/visual tests passed**. `git diff --check` passed. No diff in `src/data`, `src/domain`, `src/state.js`, restaurants, schools or CSV data. Final browser warnings/errors **0**; final home view has **0 visible personal-record/score controls**, and the background map has 29 loaded tiles. Reset the testing viewport after capture.
- Independent review: alternatives and plan reviewed separately; final adversarial code review (GPT-6-astra, high) covered three attacks and two extreme cases. First pass required redraw-focus correction; second pass accepted both focus fixes with **0 remaining Critical/Important** in that scope. Final geometry, long school card, settled background visibility and browser result are verified by the main agent, not claimed as independently browser-certified.

## Final evaluation — 89/100

Same weights as the baseline. This is the main evaluator's evidence-based design judgment, not measured user satisfaction.

| Axis | Before | After | Basis / remaining limit |
|---|---:|---:|---|
| Simplicity and visual hierarchy | 15/20 | 18/20 | Clearer blue/ink hierarchy, calmer cards and consistent widths; dense filter vocabulary remains. |
| Information fit and readability | 13/20 | 18/20 | 360px detail and 14px prose, 400px comparison list; long source-rich records still need scrolling. |
| Actions and continuity | 14/20 | 18/20 | Age carries over, mode/view changes close stale detail, keyboard focus survives redraw/close. |
| Device and use context | 8/15 | 13/15 | Legend overlap removed; a full long card fits at 320px; 844px landscape preserved. Physical iOS/Android devices were not tested. |
| Accessibility | 10/15 | 13/15 | Changed mobile targets 40px, sampled contrast passes, content background isolation and focus return verified. No screen-reader audit or full WCAG certification. |
| Consistency and restraint | 8/10 | 9/10 | Shared layout tokens, existing modes/filters/numeric/storage contracts preserved; no dependency or parallel app copy. |
| **Total** | **68/100** | **89/100** | No claim of actual user-task speed or satisfaction gain. |

Status: local implementation and validation complete; **production approved by the user's「反映」on 2026-10-22**, after presenting the result above. Publish through branch→PR→passing CI→master merge, then verify the public UI. The deployment result belongs in this operation's final report. No live-data operation or storage/schema change is involved; isolated storage/restore regressions are included in the full suite. Rollback base: e44b52d. Review images: `C:/Users/takem/.work/mont-kiara-review/ui-after-home-desktop.png`, `ui-after-dining-desktop.png`, `ui-after-dining-mobile.png`, `ui-after-filters-mobile.png`, `ui-after-school-narrow.png`. Temporary test logs were removed after recording their results here; review images remain available.
