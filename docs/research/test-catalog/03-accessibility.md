# Accessibility — Test Catalog

Provenance-first catalog of accessibility tests for a web-application launch-readiness
auditor. Every row is traceable to a Perplexity-surfaced source (raw JSON in `raw/`).
Primary axis: **WCAG 2.2 success criteria** (the obsolete 4.1.1 Parsing noted separately)
plus the **Deque axe-core automated ruleset** and the **W3C WAI-ARIA APG manual
procedures**.

**Automatable column key:** `Auto` = reliably checked by axe-core / a rules engine;
`Partial` = tool gives a partial signal, human confirmation required; `Manual` = requires
keyboard / screen-reader / human judgment.

## Sources used

| Source | Org | Covers | URL |
|---|---|---|---|
| WCAG 2.1 | W3C WAI | Web content accessibility success criteria, Levels A/AA/AAA | https://www.w3.org/TR/WCAG21/ |
| WCAG 2.2 (also ISO/IEC 40500:2025) | W3C WAI | Updated success criteria; adds focus/dragging/target-size/auth criteria; removes 4.1.1 Parsing | https://www.w3.org/WAI/standards-guidelines/wcag/ |
| How to Meet WCAG 2.2 (Quick Reference) | W3C WAI | Filterable SC + sufficient techniques + common failures — test-case index | https://www.w3.org/WAI/WCAG22/quickref/ |
| WAI-ARIA Authoring Practices Guide (APG) | W3C WAI | Keyboard + roles/states/properties for widget patterns (dialog, menu, tabs, combobox, etc.) | https://www.w3.org/WAI/ARIA/apg/ |
| axe-core rules (rule-descriptions.md) | Deque Systems | Automated rule IDs mapped to WCAG SC + tags (wcag2a/wcag2aa/wcag21aa/best-practice) | https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md |
| Deque University axe HTML rules | Deque Systems | Human-readable index of axe HTML rules | https://dequeuniversity.com/rules/axe/ |
| Section 508 (Revised 2017) | U.S. Access Board / GSA | Federal ICT requirements; incorporates WCAG 2.0 A/AA by reference | https://www.access-board.gov/ict/ |
| EN 301 549 | ETSI / CEN / CENELEC | EU ICT procurement standard; incorporates WCAG A/AA (Clause 9) | https://www.etsi.org/standards |

---

## Tests — WCAG 2.2 Success Criteria

### Principle 1 — Perceivable (Guidelines 1.1–1.4)

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable |
|---|---|---|---|---|---|---|---|
| 1 | Non-text Content | All non-text content has a text alternative | Text alternatives | WCAG 1.1.1 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 2 | Audio-only and Video-only (Prerecorded) | Prerecorded audio-only has transcript; video-only has audio track or transcript | Time-based media | WCAG 1.2.1 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 3 | Captions (Prerecorded) | Prerecorded synchronized media has captions | Time-based media | WCAG 1.2.2 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 4 | Audio Description or Media Alternative (Prerecorded) | Prerecorded synced media has audio description or full media alternative | Time-based media | WCAG 1.2.3 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |
| 5 | Captions (Live) | Live synchronized media with audio has captions | Time-based media | WCAG 1.2.4 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |
| 6 | Audio Description (Prerecorded) | Prerecorded synced media has audio description | Time-based media | WCAG 1.2.5 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |
| 7 | Info and Relationships | Structure/relationships conveyed visually are programmatically exposed | Adaptable | WCAG 1.3.1 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 8 | Meaningful Sequence | Content reading/DOM order preserves meaning | Adaptable | WCAG 1.3.2 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |
| 9 | Sensory Characteristics | Instructions do not rely solely on shape, color, size, location, or sound | Adaptable | WCAG 1.3.3 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |
| 10 | Orientation | Content not locked to a single display orientation unless essential | Adaptable | WCAG 1.3.4 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 11 | Identify Input Purpose | Common form-field purposes exposed programmatically (autocomplete tokens) | Adaptable | WCAG 1.3.5 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 12 | Use of Color | Color is not the only means of conveying information | Distinguishable | WCAG 1.4.1 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 13 | Audio Control | Auto-playing audio >3s can be paused/stopped/muted | Distinguishable | WCAG 1.4.2 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 14 | Contrast (Minimum) | Text contrast meets AA ratio thresholds (4.5:1 / 3:1 large) | Distinguishable | WCAG 1.4.3 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Auto |
| 15 | Resize Text | Text resizes to 200% without loss of content/function | Distinguishable | WCAG 1.4.4 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 16 | Images of Text | Real text used instead of images of text unless essential | Distinguishable | WCAG 1.4.5 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |
| 17 | Reflow | Content reflows without horizontal scroll at 320 CSS px width | Distinguishable | WCAG 1.4.10 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 18 | Non-text Contrast | UI components and meaningful graphics have ≥3:1 contrast | Distinguishable | WCAG 1.4.11 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 19 | Text Spacing | User text-spacing overrides don't break content/function | Distinguishable | WCAG 1.4.12 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 20 | Content on Hover or Focus | Hover/focus content is dismissible, hoverable, persistent | Distinguishable | WCAG 1.4.13 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |

**AAA (Perceivable):** 1.2.6 Sign Language, 1.2.7 Extended Audio Description, 1.2.8 Media Alternative, 1.2.9 Audio-only (Live), 1.4.6 Contrast (Enhanced, 7:1), 1.4.7 Low or No Background Audio, 1.4.8 Visual Presentation, 1.4.9 Images of Text (No Exception) — all WCAG 2.2, https://www.w3.org/WAI/WCAG22/quickref/ — Manual/Partial. (Surfaced as AAA set; enumerated by reference, not individually mined.)

### Principle 2 — Operable (Guidelines 2.1–2.5)

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable |
|---|---|---|---|---|---|---|---|
| 21 | Keyboard | All functionality operable via keyboard | Keyboard accessible | WCAG 2.1.1 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 22 | No Keyboard Trap | Focus can move into and out of any component via keyboard | Keyboard accessible | WCAG 2.1.2 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |
| 23 | Character Key Shortcuts | Single-char shortcuts can be turned off/remapped/focus-scoped | Keyboard accessible | WCAG 2.1.4 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 24 | Timing Adjustable | Time limits can be turned off/adjusted/extended | Enough time | WCAG 2.2.1 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |
| 25 | Pause, Stop, Hide | Moving/auto-updating content (>5s) can be paused/stopped/hidden | Enough time | WCAG 2.2.2 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 26 | Three Flashes or Below Threshold | No content flashes >3x/sec above general/red flash thresholds | Seizures | WCAG 2.3.1 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 27 | Bypass Blocks | Mechanism to skip repeated blocks (skip link / landmarks) | Navigable | WCAG 2.4.1 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Auto |
| 28 | Page Titled | Page has a title describing topic/purpose | Navigable | WCAG 2.4.2 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Auto |
| 29 | Focus Order | Focus order preserves meaning and operability | Navigable | WCAG 2.4.3 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |
| 30 | Link Purpose (In Context) | Link purpose determinable from text + context | Navigable | WCAG 2.4.4 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 31 | Multiple Ways | More than one way to locate a page in a set | Navigable | WCAG 2.4.5 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |
| 32 | Headings and Labels | Headings and labels describe topic/purpose | Navigable | WCAG 2.4.6 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 33 | Focus Visible | Keyboard focus indicator is visible | Navigable | WCAG 2.4.7 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 34 | Focus Not Obscured (Minimum) — **new in 2.2** | Focused component is at least partially visible (not fully hidden by author content) | Navigable | WCAG 2.4.11 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |
| 35 | Focus Appearance — **new in 2.2** | Focus indicator meets minimum size/contrast vs unfocused state | Navigable | WCAG 2.4.13 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 36 | Pointer Gestures | Multipoint/path gestures have single-pointer non-path alternative | Input modalities | WCAG 2.5.1 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |
| 37 | Pointer Cancellation | Single-pointer actions fire on up-event or can be aborted/undone | Input modalities | WCAG 2.5.2 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |
| 38 | Label in Name | Visible label text is contained in the accessible name | Input modalities | WCAG 2.5.3 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Auto |
| 39 | Motion Actuation | Motion-operated functions have UI alternative and motion can be disabled | Input modalities | WCAG 2.5.4 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |
| 40 | Dragging Movements — **new in 2.2** | Dragging functions have single-pointer non-drag alternative | Input modalities | WCAG 2.5.7 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |
| 41 | Target Size (Minimum) — **new in 2.2** | Pointer targets ≥24×24 CSS px (or spacing/inline/UA exceptions) | Input modalities | WCAG 2.5.8 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |

**AAA (Operable):** 2.1.3 Keyboard (No Exception), 2.2.3 No Timing, 2.2.4 Interruptions, 2.2.5 Re-authenticating, 2.2.6 Timeouts, 2.3.2 Three Flashes, 2.3.3 Animation from Interactions, 2.4.8 Location, 2.4.9 Link Purpose (Link Only), 2.4.10 Section Headings, 2.4.12 Focus Not Obscured (Enhanced, **new in 2.2**), 2.5.5 Target Size (Enhanced, 44×44), 2.5.6 Concurrent Input Mechanisms — all WCAG 2.2, https://www.w3.org/WAI/WCAG22/quickref/ — mostly Manual/Partial.

### Principle 3 — Understandable (Guidelines 3.1–3.3)

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable |
|---|---|---|---|---|---|---|---|
| 42 | Language of Page | Default page language declared programmatically (`<html lang>`) | Readable | WCAG 3.1.1 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Auto |
| 43 | Language of Parts | In-content language changes identified programmatically | Readable | WCAG 3.1.2 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 44 | On Focus | Receiving focus does not trigger unexpected context change | Predictable | WCAG 3.2.1 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 45 | On Input | Changing a control value does not trigger unexpected context change | Predictable | WCAG 3.2.2 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 46 | Consistent Navigation | Repeated navigation appears in consistent relative order | Predictable | WCAG 3.2.3 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 47 | Consistent Identification | Same-function components identified consistently | Predictable | WCAG 3.2.4 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 48 | Consistent Help — **new in 2.2** | Help mechanisms appear in consistent relative order across pages | Predictable | WCAG 3.2.6 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |
| 49 | Error Identification | Input errors identified and described in text | Input assistance | WCAG 3.3.1 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 50 | Labels or Instructions | Form controls have clear labels/instructions | Input assistance | WCAG 3.3.2 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 51 | Error Suggestion | Correction suggestions offered when known | Input assistance | WCAG 3.3.3 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |
| 52 | Error Prevention (Legal, Financial, Data) | Critical submissions reversible/checkable/confirmable | Input assistance | WCAG 3.3.4 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |
| 53 | Redundant Entry — **new in 2.2** | Previously entered info not re-required in same process | Input assistance | WCAG 3.3.7 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |
| 54 | Accessible Authentication (Minimum) — **new in 2.2** | Auth not dependent solely on a cognitive function test | Input assistance | WCAG 3.3.8 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Manual |

**AAA (Understandable):** 3.1.3 Unusual Words, 3.1.4 Abbreviations, 3.1.5 Reading Level, 3.1.6 Pronunciation, 3.2.5 Change on Request, 3.3.5 Help, 3.3.6 Error Prevention (All), 3.3.9 Accessible Authentication (Enhanced, **new in 2.2**) — all WCAG 2.2, https://www.w3.org/WAI/WCAG22/quickref/ — Manual.

### Principle 4 — Robust (Guideline 4.1)

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable |
|---|---|---|---|---|---|---|---|
| 55 | Name, Role, Value | Name/role/state/value of UI components programmatically determinable | Compatible | WCAG 4.1.2 (A) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |
| 56 | Status Messages | Status messages exposed to AT without moving focus (live regions) | Compatible | WCAG 4.1.3 (AA) | WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | Partial |

**Note — 4.1.1 Parsing (was Level A):** Obsolete and **removed from WCAG 2.2 conformance**. W3C states 4.1.1 is obsolete; it should not be counted among active WCAG 2.2 SCs even though it appears in WCAG 2.0/2.1 materials. (raw/accessibility-05.json) https://www.w3.org/WAI/standards-guidelines/wcag/

---

## Tests — axe-core automated rules (Deque)

Each rule maps to one or more WCAG SC via its tags. axe-core publishes ~90+ rules; the
canonical machine-readable list is `doc/rule-descriptions.md` in the installed axe-core
version. Rows below are the rules Perplexity surfaced from that file and the Deque
University index (raw/accessibility-06.json, raw/accessibility-07.json). All are `Auto`
(rules-engine-executable) unless noted.

### Images / non-text content
| Rule ID | What it checks | WCAG SC | Tag |
|---|---|---|---|
| area-alt | `<area>` in image maps has alt text | 1.1.1 | wcag2a |
| image-alt | `<img>` has non-empty accessible name where required | 1.1.1 | wcag2a |
| input-image-alt | Image input buttons have accessible name | 1.1.1 | wcag2a |
| object-alt | `<object>` rendering non-text content has accessible name | 1.1.1 | wcag2a |
| svg-img-alt | SVG with img role has accessible name | 1.1.1 | wcag2a |
| role-img-alt | Elements with role=img have alternative text | 1.1.1 | wcag2a |
| image-redundant-alt | Image alt does not duplicate adjacent text | (1.1.1) | best-practice |
| server-side-image-map | Server-side image maps not used | (1.1.1/2.4.4) | best-practice |

### Media / time-based
| Rule ID | What it checks | WCAG SC | Tag |
|---|---|---|---|
| audio-caption | `<audio>` provides caption track when needed | 1.2.2 | wcag2a |
| video-caption | `<video>` provides caption track | 1.2.2 | wcag2a |
| no-autoplay-audio | Audio/video does not autoplay >3s without control | 1.4.2 | wcag2a |
| blink | `<blink>` element not used | (2.2.2) | best-practice |
| marquee | `<marquee>` element not used | (2.2.2) | best-practice |

### Color / contrast
| Rule ID | What it checks | WCAG SC | Tag |
|---|---|---|---|
| color-contrast | Text meets AA contrast thresholds | 1.4.3 | wcag2aa |
| color-contrast-enhanced | Text meets AAA contrast thresholds | 1.4.6 | wcag2aaa |
| link-in-text-block | Links distinguishable without relying on color alone | 1.4.1 | wcag2a |

### Forms / labels
| Rule ID | What it checks | WCAG SC | Tag |
|---|---|---|---|
| label | Form inputs have a label / accessible name | 1.3.1, 3.3.2 | wcag2a |
| select-name | `<select>` has an accessible name | 1.3.1, 3.3.2 | wcag2a |
| button-name | Buttons have discernible text | 4.1.2 | wcag2a |
| input-button-name | Input buttons have discernible text | 4.1.2 | wcag2a |
| form-field-multiple-labels | Form field not associated with multiple labels | 1.3.1 | wcag2a |
| label-content-name-mismatch | Visible label text is part of accessible name | 2.5.3 | wcag21aa |
| autocomplete-valid | autocomplete attribute uses a valid/appropriate token | 1.3.5 | wcag21aa |
| aria-input-field-name | ARIA input fields have an accessible name | 4.1.2 | wcag2a |

### ARIA (roles / states / properties)
| Rule ID | What it checks | WCAG SC | Tag |
|---|---|---|---|
| aria-allowed-attr | ARIA attrs are permitted for the element's role | 4.1.2 | wcag2a |
| aria-allowed-role | role value is allowed for the element | 4.1.2 | best-practice |
| aria-valid-attr | ARIA attribute names are valid | 4.1.2 | wcag2a |
| aria-valid-attr-value | ARIA attribute values are valid | 4.1.2 | wcag2a |
| aria-role / aria-roles | role is valid and not abstract | 4.1.2 | wcag2a |
| aria-required-attr | Required ARIA states/properties present for role | 4.1.2 | wcag2a |
| aria-required-children | Composite roles contain required owned elements | 1.3.1 | wcag2a |
| aria-required-parent | Owned elements have required parent role | 1.3.1 | wcag2a |
| aria-command-name | ARIA commands (button/link/menuitem) have accessible name | 4.1.2 | wcag2a |
| aria-toggle-field-name | ARIA toggle fields have accessible name | 4.1.2 | wcag2a |
| aria-tooltip-name | ARIA tooltip has accessible name | 4.1.2 | wcag2a |
| aria-meter-name | ARIA meter has accessible name | 1.1.1 | wcag2a |
| aria-progressbar-name | ARIA progressbar has accessible name | 1.1.1 | wcag2a |
| aria-dialog-name | ARIA dialog/alertdialog has accessible name | 4.1.2 | best-practice |
| aria-text | role=text does not contain focusable descendants | 1.3.1 | best-practice |
| aria-treeitem-name | ARIA treeitem has accessible name | 4.1.2 | best-practice |
| aria-hidden-body | aria-hidden not present on document body | 4.1.2 | wcag2a |
| aria-hidden-focus | aria-hidden element has no focusable content | 1.3.1, 4.1.2 | wcag2a |
| aria-prohibited-attr | ARIA attrs prohibited on the element are not used | 4.1.2 | wcag2a |
| aria-conditional-attr | Conditionally-allowed ARIA attrs used correctly | 4.1.2 | wcag2a |
| aria-deprecated-role | Deprecated ARIA roles not used | 4.1.2 | best-practice |
| aria-roledescription | aria-roledescription only on elements with a semantic role | 4.1.2 | best-practice |
| presentation-role-conflict | role=presentation/aria-hidden has no focusable/semantic children | 1.3.1, 4.1.2 | best-practice |
| dpub-aria-allowed-role | DPUB roles used on elements with implicit fallback | (robust) | best-practice |

### Structure / landmarks / headings
| Rule ID | What it checks | WCAG SC | Tag |
|---|---|---|---|
| region | Content is contained within landmarks | 1.3.1 | best-practice |
| landmark-one-main | Exactly one main landmark | 1.3.1 | best-practice |
| landmark-unique | Landmarks have unique role/label combination | 1.3.1 | best-practice |
| landmark-main-is-top-level | main landmark not nested in another landmark | 1.3.1 | best-practice |
| landmark-banner-is-top-level | banner landmark is top level | 1.3.1 | best-practice |
| landmark-complementary-is-top-level | complementary landmark is top level | 1.3.1 | best-practice |
| landmark-contentinfo-is-top-level | contentinfo landmark is top level | 1.3.1 | best-practice |
| landmark-no-duplicate-banner | At most one banner landmark | 1.3.1 | best-practice |
| landmark-no-duplicate-contentinfo | At most one contentinfo landmark | 1.3.1 | best-practice |
| landmark-no-duplicate-main | At most one main landmark | 1.3.1 | best-practice |
| page-has-heading-one | Page contains an h1 | (1.3.1) | best-practice |
| heading-order | Heading levels increase by one (no skips) | (1.3.1) | best-practice |
| empty-heading | Headings are not empty | 1.3.1 | best-practice |
| p-as-heading | Styled `<p>` not used in place of a heading | 1.3.1 | best-practice |
| list | `<ul>`/`<ol>` contain only allowed children | 1.3.1 | wcag2a |
| listitem | `<li>` contained in `<ul>`/`<ol>` | 1.3.1 | wcag2a |
| definition-list | `<dl>` directly contains properly ordered dt/dd groups | 1.3.1 | wcag2a |
| dlitem | `<dt>`/`<dd>` contained by a `<dl>` | 1.3.1 | wcag2a |
| bypass | Mechanism to bypass repeated blocks exists | 2.4.1 | wcag2a |
| skip-link | Skip-link target exists and is focusable | 2.4.1 | best-practice |

### Tables
| Rule ID | What it checks | WCAG SC | Tag |
|---|---|---|---|
| td-headers-attr | headers attr cells refer to cells in same table | 1.3.1 | wcag2a |
| th-has-data-cells | th/header roles have associated data cells | 1.3.1 | wcag2a |
| td-has-header | Non-empty td in tables >3×3 has an associated header | 1.3.1 | wcag2a |
| scope-attr-valid | scope attribute used correctly on header cells | 1.3.1 | best-practice |
| empty-table-header | Table header cells are not empty | (1.3.1) | best-practice |
| table-duplicate-name | Table summary and caption are not identical | (1.3.1) | best-practice |
| table-fake-caption | Data/header cells not used as a caption substitute | 1.3.1 | best-practice |
| layout-table | Layout tables don't use data-table semantics | 1.3.1 | wcag2a |

### Language / page metadata
| Rule ID | What it checks | WCAG SC | Tag |
|---|---|---|---|
| html-has-lang | `<html>` has a lang attribute | 3.1.1 | wcag2a |
| html-lang-valid / valid-lang | lang attribute has a valid language tag | 3.1.1 | wcag2a |
| html-xml-lang-mismatch | lang and xml:lang share a base language | 3.1.1 | wcag2a |
| document-title | Document has a non-empty `<title>` | 2.4.2 | wcag2a |
| meta-refresh | No timed `<meta http-equiv=refresh>` (with exceptions) | 2.2.1 | wcag2a |
| meta-refresh-no-exceptions | No meta refresh at all (stricter) | 2.2.1 | best-practice |
| meta-viewport | Viewport allows zoom up to ~500% (no user-scalable=no) | 1.4.4 | wcag2aa |
| meta-viewport-large | Viewport allows zoom to 500% | 1.4.4 | best-practice |
| css-orientation-lock | CSS does not lock display orientation | 1.3.4 | wcag21aa |

### Links / buttons
| Rule ID | What it checks | WCAG SC | Tag |
|---|---|---|---|
| link-name | Links have discernible text / accessible name | 2.4.4, 4.1.2 | wcag2a |
| identical-links-same-purpose | Links with identical names have equivalent purpose | (2.4.9) | best-practice |
| accesskeys | accesskey values are unique | (best-practice) | best-practice |

### Keyboard / focus
| Rule ID | What it checks | WCAG SC | Tag |
|---|---|---|---|
| nested-interactive | No nested interactive controls (breaks AT announcement) | 1.3.1, 4.1.2 | wcag2a |
| scrollable-region-focusable | Scrollable regions reachable via sequential focus | 2.1.1 | wcag2a |
| tabindex | No positive tabindex values | (2.4.3) | best-practice |
| focus-order-semantics | Elements in focus order have appropriate role | (1.3.1) | best-practice |

### Frames / uniqueness / validity
| Rule ID | What it checks | WCAG SC | Tag |
|---|---|---|---|
| frame-title | Frames/iframes have a title attribute | 4.1.2 | wcag2a |
| frame-title-unique | Frame titles are unique | (best-practice) | best-practice |
| frame-focusable-content | Frames with focusable content not aria-hidden | 4.1.2 | wcag2a |
| frame-tested | iframes are scanned by axe-core (informational) | n/a | best-practice |
| duplicate-id-aria | IDs used by ARIA/labels are unique | 4.1.2 | wcag2a |
| summary-name | `<summary>` has discernible accessible name | 4.1.2 | best-practice |
| avoid-inline-spacing | Inline text spacing not forced via !important (overridable) | 1.4.12 | wcag21aa |
| target-size | Touch targets meet minimum size/spacing | 2.5.8 | wcag22aa |
| hidden-content | Hidden content cannot be analyzed (informational) | n/a | best-practice |

---

## Tests — Manual procedures (WAI-ARIA APG + WCAG keyboard/screen-reader)

These require keyboard interaction or a real screen reader (NVDA / JAWS / VoiceOver).
Source: raw/accessibility-07.json (W3C APG + WCAG keyboard guidance).

### Keyboard navigation
| # | Test / Check | What it verifies | Standard ref | Automatable |
|---|---|---|---|---|
| K1 | Keyboard access + logical tab order | Every control operable via keyboard; Tab order matches visual order | WCAG 2.1.1, 2.4.3 | Partial |
| K2 | Focus visibility | Visible focus indicator on every focusable element; outline not suppressed | WCAG 2.4.7, 1.4.11 | Partial |
| K3 | No keyboard trap | Focus can exit every widget/region via keyboard (Tab/Shift+Tab/Esc) | WCAG 2.1.2 | Manual |
| K4 | Skip link / bypass blocks | Skip-to-main link present, visible on focus, moves focus to main | WCAG 2.4.1 | Partial |
| K5 | Focus management on SPA route change | Focus moves to a meaningful element after route/view change | WCAG 2.4.3 (+3.2.3) | Manual |
| K6 | Modal dialog focus trap + return | Focus enters dialog, cycles within, Esc closes, returns to opener | WCAG 2.1.1, 2.1.2, 2.4.3; APG Dialog | Manual |
| K7 | Character key shortcuts controllable | Single-char shortcuts disableable/remappable/focus-scoped | WCAG 2.1.4 | Manual |

### Screen-reader testing
| # | Test / Check | What it verifies | Standard ref | Automatable |
|---|---|---|---|---|
| S1 | Headings announced with correct levels | Programmatic headings form a logical outline via SR navigation | WCAG 1.3.1 | Partial |
| S2 | Landmarks announced and labeled | Header/nav/main/footer/aside exposed and meaningfully labeled | WCAG 1.3.1, 2.4.1 | Partial |
| S3 | Form labels/roles/groups announced | Control type, label, group legend announced; required state exposed | WCAG 1.3.1, 3.3.2 | Partial |
| S4 | Error messages announced | Errors programmatically associated and announced (focus or live region) | WCAG 3.3.1, 3.3.3, 4.1.3 | Partial |
| S5 | Live regions / status messages | Dynamic status read without focus change (role=status/alert/aria-live) | WCAG 4.1.3 | Manual |
| S6 | Alt text quality | Meaningful images have equivalent alt; decorative images skipped | WCAG 1.1.1 | Partial |
| S7 | Link purpose via SR | Link purpose clear from accessible name + context in link list | WCAG 2.4.4 | Partial |
| S8 | Table headers announced | Row/column headers announced with cell content during table nav | WCAG 1.3.1 | Partial |

### ARIA widget patterns (APG) — expected keyboard interaction
| # | Widget | Expected keys verified | Standard ref | Automatable |
|---|---|---|---|---|
| W1 | Dialog (modal) | Tab/Shift+Tab trap, Esc closes, focus returns; role=dialog, aria-modal | WCAG 2.1.1/2.1.2/2.4.3; APG Dialog | Manual (Partial for static ARIA) |
| W2 | Menu / menubar | Enter/Space/Arrows open & navigate, Esc closes, Home/End | WCAG 2.1.1/2.1.2/2.4.3; APG Menu | Manual |
| W3 | Tabs | Arrow keys move/activate tabs, Tab into panel, Home/End; aria-selected | WCAG 2.1.1/2.4.3; APG Tabs | Manual |
| W4 | Combobox / autocomplete | Type filters, Down opens, arrows navigate, Enter selects, Esc closes; aria-expanded | WCAG 2.1.1/4.1.2; APG Combobox | Manual |
| W5 | Accordion | Enter/Space toggles panel, optional Up/Down/Home/End; aria-expanded | WCAG 2.1.1/2.4.3; APG Accordion | Manual |
| W6 | Disclosure (show/hide) | Enter/Space toggles; aria-expanded updated | WCAG 2.1.1; APG Disclosure | Manual |
| W7 | Listbox (single/multi) | Arrows move, Enter/Space select, Shift/Ctrl multi-select, Home/End; aria-selected | WCAG 2.1.1/4.1.2; APG Listbox | Manual |
| W8 | Slider | Arrows/PageUp/PageDown/Home/End change value; aria-valuenow announced | WCAG 2.1.1/4.1.2; APG Slider | Manual |
| W9 | Tooltip | Appears on focus + hover, aria-describedby, dismissible, no focus trap | WCAG 1.4.13/1.3.1; APG Tooltip | Manual |
| W10 | Carousel | Controls keyboard-operable, auto-advance has pause, slide change perceivable | WCAG 2.1.1/2.2.2/2.4.3/4.1.2; APG composite | Manual |

---

## Coverage notes (completeness)

The following accessibility categories are commonly missed by WCAG/axe-only checklists
and are surfaced here for catalog completeness (mapped to the SC already enumerated
above): mobile/touch (2.5.7, 2.5.8, 1.3.4), zoom/reflow at 400% (1.4.10, 1.4.4),
reduced-motion `prefers-reduced-motion` (2.3.3, 2.2.2), color-blindness simulation (1.4.1,
1.4.11), accessible authentication (3.3.8/3.3.9), live-region timing (4.1.3), autocomplete
tokens (1.3.5), and the core gap that automated tools catch only ~30-40% of WCAG issues —
real-AT manual testing (sections K/S/W above) is required for full conformance. These
categories all trace to SC already mined and sourced in raw files 01-05.

## Unverified / needs a source

None of the catalogued rows are unverified — every WCAG SC, axe rule ID, and manual
procedure above appeared in a Perplexity answer or its citations (raw files 01-07).

## [MODEL-SUGGESTED — confirm]

Two planned completeness calls were NOT executed (a local disk-full condition blocked the
shell, then the orchestrator directed no further Perplexity calls):
- Extended axe-core rule IDs (aria-conditional-attr, aria-prohibited-attr, autocomplete-valid,
  css-orientation-lock, frame-focusable-content, p-as-heading, summary-name, target-size,
  etc.). Most of these were already independently surfaced in raw/accessibility-06.json and
  are included above; a confirmation pass against the live `rule-descriptions.md` is
  recommended to verify exact tags and any version drift.
- A `sonar-reasoning` "commonly missed categories" sweep. The coverage-notes section above
  was assembled from SC already mined (raw 01-05), not from a dedicated sweep.

The most reliable enumeration of axe rules is to parse `doc/rule-descriptions.md` from the
exact axe-core version LaunchAudit ships, keyed by Rule ID with Tags → WCAG level + SC.

## Raw evidence

- raw/accessibility-01.json — canonical sources/standards pass (WCAG 2.1/2.2, APG, axe-core, 508, EN 301 549, ISO/IEC 40500)
- raw/accessibility-02.json — WCAG 2.2 Perceivable (1.1–1.4) enumeration
- raw/accessibility-03.json — WCAG 2.2 Operable (2.1–2.5) enumeration (incl. 2.2 new criteria)
- raw/accessibility-04.json — WCAG 2.2 Understandable (3.1–3.3) enumeration (incl. 2.2 new criteria)
- raw/accessibility-05.json — WCAG 2.2 Robust (4.1) enumeration + 4.1.1 removal note
- raw/accessibility-06.json — axe-core rule list by category with WCAG mappings + tags
- raw/accessibility-07.json — manual keyboard / screen-reader / APG widget procedures
