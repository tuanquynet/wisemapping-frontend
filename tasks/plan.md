# Implementation Plan: Search Map Node + Jump to Node

## Overview

Add an in-canvas search feature to the mind-map editor (`packages/editor`, built on `packages/mindplot`): the user opens a search box, types text, sees matching topics from the currently loaded mind map, and selecting a match pans/selects the canvas onto that node — including expanding any collapsed ancestor branch that's hiding it. This is scoped strictly to search-within-an-open-map; it is unrelated to and must not be confused with the webapp dashboard's REST-backed "search my maps" list filter (`packages/webapp/src/classes/client/admin-client`), a separate feature in a separate package.

## Architecture Decisions

- **Search matching lives in `mindplot`, not `editor`.** `mindplot` has no React dependency and is already unit-tested with Jest; putting the match logic in a `Designer.findTopicsByText()` helper keeps it testable without a browser and reusable by any future consumer (keyboard nav, Cypress, etc.), rather than duplicating filter logic inside a React `useMemo` the way `image-icon-tab` does for icons.
- **Reveal-and-jump reuses `Designer.goToNode()`, but the collapsed-ancestor-expansion step must be extracted from `DesignerKeyboard` into `Designer` first.** Today, expanding collapsed ancestors before jumping only happens inside `DesignerKeyboard._ensureTopicVisible` (private, keyboard-nav-only). Search results need the same guarantee when triggered by a mouse click on a search result, not a keyboard event. Extracting this into a public `Designer.revealNode(topic)` (expand ancestors → deselectAll → goToNode) and having `DesignerKeyboard` call the same method avoids duplicating logic in two places and keeps keyboard-nav and search-jump behavior identical.
- **UI reuses the existing toolbar `ActionConfig` + submenu `render:` popover pattern**, the same shape used for the Outline view and Keyboard Shortcuts dialogs — no new modal system.
- **Search input reuses the existing MUI search-input idiom from `image-icon-tab`** (TextField + start/end adornments + `useMemo` filter + empty-state message) for UI consistency, not a new component style.
- **Keyboard shortcut is `Ctrl/Cmd+Shift+F`, not `Ctrl/Cmd+F`.** `Ctrl/Cmd+F` is claimed by the browser's native find-in-page and isn't reliably preventable across browsers; no shortcut in mindplot or editor currently uses `f` at all, so `Shift+F` is free and matches a common "find in app" convention elsewhere.
- **No debounce, no fuzzy matching.** Follows the existing `image-icon-tab` precedent (plain substring filter via `useMemo`, no debounce) — matches current codebase conventions and the actual scale of a single mind map's topic count. Add debouncing only if a real map is later found to make this feel slow (no evidence of that today).

## Dependency Graph

```
mindplot: Designer.findTopicsByText(query) → Topic[]      mindplot: Designer.revealNode(topic)
   (new, pure logic over getModel().getTopics() +             (extracted from DesignerKeyboard._ensureTopicVisible/_goToNode:
    topic.getPlainText())                                      expand collapsed ancestors → deselectAll() → goToNode())
                    │                                                          │
                    └───────────────────┬──────────────────────────────────────┘
                                         │
                         editor: SearchPane component
                    (packages/editor/src/components/action-widget/pane/search-pane/
                     — MUI TextField+list, calls the two mindplot APIs above)
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                                          │
     editor: toolbar ActionConfig entry          editor: Ctrl/Cmd+Shift+F shortcut
     (visualization-toolbar wiring,               (visualization-toolbar keydown switch)
      opens SearchPane in a submenu popover)                   │
                    │                              editor: Keyboard-Shortcuts-Help row
                    └────────────────────┬─────────────────────┘
                                         │
                              editor: i18n strings
                    (lang/en.json: toolbar tooltip, search placeholder,
                     empty-results text, shortcut-help label)
                                         │
                          editor: Cypress end-to-end test
                    (packages/editor/cypress/e2e/search-node.cy.ts)
```

Implementation order follows this graph bottom-up: the two `mindplot` primitives first (independently unit-testable, zero UI risk), then the `editor` UI slice that consumes both together as one working mouse-driven feature, then the keyboard-shortcut layer on top of the now-working UI, then end-to-end coverage.

## Task List

### Phase 1: mindplot foundation

- [ ] Task 1: `Designer.findTopicsByText()` search helper
- [ ] Task 2: `Designer.revealNode()` reveal-and-jump, refactored out of `DesignerKeyboard`

### Checkpoint: Phase 1 (mindplot foundation)

- [ ] `yarn workspace @wisemapping/mindplot test:unit` passes, including new tests for both APIs
- [ ] No regression in existing `DesignerKeyboard`/keyboard-navigation tests after the `revealNode` extraction
- [ ] `yarn workspace @wisemapping/mindplot lint` clean
- [ ] Review with human before proceeding to UI work

### Phase 2: editor UI — mouse-driven search and jump

- [ ] Task 3: `SearchPane` component + toolbar wiring (first fully working vertical slice)

### Checkpoint: Phase 2 (working feature, mouse-only)

- [ ] Manual smoke test: open `editor.html`, click the new toolbar search icon, type a substring of an existing topic's text, click the match, confirm the canvas pans to and selects that node — including a node hidden inside a collapsed branch
- [ ] Empty query and no-match states render correctly (no crash, clear empty message)
- [ ] `yarn workspace @wisemapping/editor lint` and `yarn workspace @wisemapping/editor build` succeed
- [ ] Review with human before proceeding to keyboard shortcut

### Phase 3: keyboard entry point + documentation

- [ ] Task 4: `Ctrl/Cmd+Shift+F` shortcut + Keyboard-Shortcuts-Help update + i18n

### Checkpoint: Phase 3 (shortcut wired, documented)

- [ ] Shortcut opens the same `SearchPane` popover as the toolbar button
- [ ] Shortcut does not trigger the browser's native find-in-page (verify in at least Chrome and Firefox)
- [ ] Keyboard Shortcuts Help dialog lists the new shortcut with correct Windows/Linux and Mac key labels
- [ ] `yarn workspace @wisemapping/editor i18n:extract && yarn workspace @wisemapping/editor i18n:compile` run clean, all locale files regenerated (English strings only; other locales fall back per existing i18n convention)

### Phase 4: end-to-end verification

- [ ] Task 5: Cypress coverage for the full search-and-jump flow

### Checkpoint: Complete

- [ ] `yarn workspace @wisemapping/editor test:integration` passes including the new spec
- [ ] `yarn build` (all packages) succeeds
- [ ] All acceptance criteria across Tasks 1–5 met
- [ ] Ready for human review

## Task Details

## Task 1: `DesignerModel.findTopicsByText()` search helper ✅ DONE — implemented on `DesignerModel`, not `Designer` (see note below)

**Description:** Add a method to `mindplot`'s `Designer` class that takes a query string and returns every `Topic` in the currently loaded map whose text matches (case-insensitive substring match against `topic.getPlainText()` where available, falling back to `topic.getText()` for non-HTML topics), excluding no topics by type (central topic included — a user may legitimately search for the map's root text). Pure logic, no DOM/canvas interaction, so it's testable exactly like `zoom.test.ts` mocks `Canvas`/`ScreenManager`.

**Acceptance criteria:**

- [x] `designer.getModel().findTopicsByText('foo')` returns all topics whose plain text contains "foo", case-insensitively
- [x] Empty/whitespace-only query returns an empty array (not all topics — the caller decides what "no query" means, but the helper itself should not silently return everything, which would be a surprising default for a "find" API)
- [x] Matches plain-text via `topic.getModel().getPlainText()`, which already strips HTML for `ContentType.HTML` topics — no separate HTML/plain-text branching needed in the helper itself

**Verification:**

- [x] Tests pass: `yarn workspace @wisemapping/mindplot test:unit` (`test/unit/designer-model-search.test.ts`)
- [x] Build succeeds: `yarn workspace @wisemapping/mindplot build`
- [x] Manual check: none needed — pure unit-testable logic

**Dependencies:** None

**Implementation note:** landed on `DesignerModel` instead of `Designer` — that's where `_topics`, `filterSelectedTopics()`, and `filterTopicsIds()` already live, and it's constructible in a test with just `{ zoom }`, with no `Designer`/DOM/Canvas mocking required. Task 3's `SearchPane` should call `designer.getModel().findTopicsByText(query)`.

**Files touched:**

- `packages/mindplot/src/components/DesignerModel.ts` (new method, after `filterSelectedTopics()`)
- `packages/mindplot/test/unit/designer-model-search.test.ts` (new)

**Estimated scope:** Small (1–2 files)

---

## Task 2: `Designer.revealNode()` reveal-and-jump ✅ DONE — ancestor-walking logic extracted to `util/topicVisibility.ts`, not inlined (see implementation note below)

**Description:** Extract the collapsed-ancestor-expansion + deselect + focus/pan sequence currently living only inside `DesignerKeyboard._ensureTopicVisible` / `_goToNode` into a public `Designer.revealNode(topic: Topic): void` method: expand every collapsed ancestor of `topic`, call `deselectAll()`, then call the existing `goToNode(topic)` (which already handles focus + `ensureNodeVisible` → `Canvas.ensureVisible`). Refactor `DesignerKeyboard` to call `Designer.revealNode()` instead of its own inline private logic, so keyboard navigation and the new search feature share one code path and cannot drift apart.

**Acceptance criteria:**

- [x] Calling `designer.revealNode(topic)` on a topic nested inside a collapsed ancestor expands that ancestor (and any further collapsed ancestors above it) before panning — proven by `getCollapsedAncestorIds()`'s unit tests (grandparent-only-collapsed and multi-level cases)
- [x] Calling `designer.revealNode(topic)` on an already-visible topic behaves identically to today's `goToNode(topic)` (deselect others, focus, pan into view) — `revealNode` is a strict superset: it's a no-op ancestor-expansion (empty id list) followed by the exact same `deselectAll()` + `goToNode()` calls that existed before
- [x] Existing `DesignerKeyboard` arrow-key navigation between topics still expands collapsed branches exactly as before the refactor — verified by code inspection: all 5 call sites that previously paired `_ensureTopicVisible` + `_goToNode` now call `designer.revealNode()`; the 2 call sites that never called `_ensureTopicVisible` (central-topic fallback in `_moveSelection`, `_goToSideChild`) were deliberately left calling the unchanged `_goToNode` helper, not upgraded to `revealNode`, so no new expansion behavior was introduced anywhere

**Verification:**

- [x] Tests pass: `yarn workspace @wisemapping/mindplot test:unit` (229/229, up from 224) — no existing `DesignerKeyboard` test suite existed to regress (confirmed by search before starting); the new `getCollapsedAncestorIds()` unit tests (5 cases) cover the extracted logic directly
- [x] Build succeeds: `yarn workspace @wisemapping/mindplot build`
- [ ] Manual check (not yet performed): in the running editor, collapse a branch, use arrow-key navigation into a topic inside it, confirm it still auto-expands

**Dependencies:** None (independent of Task 1; both are mindplot-only)

**Implementation note:** `getCollapsedAncestorIds(topic)` — the pure ancestor-walking logic — lives in a new `packages/mindplot/src/components/util/topicVisibility.ts`, not inline in `Designer.ts` as originally planned. Reason: `Designer.ts` transitively imports `WidgetBuilder` → `SvgImageIcon.ts`, which calls Vite-only `import.meta.glob` — loading `Designer.ts` as a _value_ (not just a type) inside Jest throws `TS1343`. Any test importing a named/default export _function_ from `Designer.ts` would hit this; a type-only `import type Topic` reference does not (confirmed: the file's only import is type-only). `Designer.revealNode()` itself (thin orchestration: call the pure helper, conditionally `shrinkBranch`, `deselectAll`, `goToNode`) has no direct unit test — matching the existing test-coverage depth of `Designer.goToNode()`/`ensureNodeVisible()`, neither of which has one either, for the same reason.

**Files touched:**

- `packages/mindplot/src/components/util/topicVisibility.ts` (new — `getCollapsedAncestorIds`, default export per `import/prefer-default-export`)
- `packages/mindplot/src/components/Designer.ts` (new `revealNode` method, imports `getCollapsedAncestorIds`)
- `packages/mindplot/src/components/DesignerKeyboard.ts` (5 call sites now call `designer.revealNode()`; dead `_ensureTopicVisible` removed; `_goToNode` kept for the 2 non-expanding call sites)
- `packages/mindplot/test/unit/designer-collapsed-ancestors.test.ts` (new, 5 cases)

**Estimated scope:** Small–Medium (4 files touched, in line with the plan's estimate; one of the four is the new util file the plan didn't anticipate)

---

## Task 3: `SearchPane` component + toolbar wiring

**Description:** Build the first complete, mouse-usable vertical slice: a new toolbar `ActionConfig` (search icon) that opens a submenu popover (same `render:` pattern as `OutlineViewDialog`/`KeyboardShorcutsHelp`) containing a new `SearchPane` component. `SearchPane` follows the `image-icon-tab` idiom — a MUI `TextField` with a search icon `startAdornment` and clear `endAdornment`, filtering via `designer.getModel().findTopicsByText()` (Task 1) on every keystroke (`useMemo`, no debounce), rendering a scrollable list of matches (topic text + a short ancestor-path breadcrumb if helpful for disambiguating same-text topics). Clicking a result calls `designer.revealNode()` (Task 2) and closes the popover.

**Acceptance criteria:**

- [ ] A new toolbar icon opens the search popover; typing filters the list live against every topic's text in the currently loaded map
- [ ] Clicking a result pans the canvas to that node, visually selects it, and closes the popover
- [ ] Typing a query with zero matches shows a clear "no results" message instead of an empty blank list
- [ ] Clearing the query (via the clear button or deleting all text) shows either the full topic list or a neutral empty-query state (pick one, document the choice in the component) rather than crashing or showing stale results
- [ ] The popover can be dismissed without selecting anything (click-away or an explicit close), leaving the canvas untouched

**Verification:**

- [ ] Tests pass: `yarn workspace @wisemapping/editor lint`
- [ ] Build succeeds: `yarn workspace @wisemapping/editor build`
- [ ] Manual check: run `yarn workspace @wisemapping/webapp dev`, open a map with a collapsed branch containing a uniquely-named node, search for it, click it, confirm the branch expands and the canvas centers on it

**Dependencies:** Task 1, Task 2

**Files likely touched:**

- `packages/editor/src/components/action-widget/pane/search-pane/index.tsx` (new)
- `packages/editor/src/components/visualization-toolbar/index.tsx` (new `ActionConfig` entry)
- `packages/editor/src/classes/action/action-config/index.ts` (only if the interface needs a new optional field — check first, likely no change needed)
- `packages/editor/lang/en.json` (new keys: toolbar tooltip/aria-label, search placeholder, empty-results message)

**Estimated scope:** Medium (3–5 files)

---

## Task 4: `Ctrl/Cmd+Shift+F` shortcut + Keyboard-Shortcuts-Help + i18n compile

**Description:** Add a `Ctrl/Cmd+Shift+F` entry to `visualization-toolbar`'s existing document-level `keydown` switch (same style as the existing `0`/`-`/`=`/`o`/`e` entries), calling `event.preventDefault()` and opening the same `SearchPane` popover Task 3 built. Add a corresponding row to the Keyboard Shortcuts Help dialog (`action-widget/pane/keyboard-shortcut-help`) with correct Windows/Linux (`Ctrl+Shift+F`) and Mac (`⌘+Shift+F`) labels. Run the i18n extract/compile pipeline so all new strings from Tasks 3–4 land in `lang/en.json` and every compiled locale file.

**Acceptance criteria:**

- [ ] `Ctrl+Shift+F` (Windows/Linux) and `Cmd+Shift+F` (Mac) open the search popover from anywhere the canvas has focus
- [ ] The shortcut does not trigger the browser's native find-in-page in Chrome or Firefox (manual check — `preventDefault` is called)
- [ ] The shortcut is a no-op (or explicitly handled) while a topic's inline text editor is focused, matching the existing `isTypingInInputField()` convention used elsewhere for shortcut suppression
- [ ] The Keyboard Shortcuts Help dialog shows the new shortcut with correct platform-specific key labels
- [ ] `yarn workspace @wisemapping/editor i18n:extract` picks up all new message keys with no manual edits needed to `en.json` beyond what extraction generates from source

**Verification:**

- [ ] Tests pass: `yarn workspace @wisemapping/editor lint`
- [ ] Build succeeds: `yarn workspace @wisemapping/editor build` (includes `i18n:compile` per its build script)
- [ ] Manual check: trigger the shortcut in both a Chromium-based browser and Firefox; open the Keyboard Shortcuts Help dialog and confirm the new row renders correctly

**Dependencies:** Task 3

**Files likely touched:**

- `packages/editor/src/components/visualization-toolbar/index.tsx` (keydown switch)
- `packages/editor/src/components/action-widget/pane/keyboard-shortcut-help/index.tsx` (new table row)
- `packages/editor/lang/en.json` and generated `src/compiled-lang/*.json` (via `i18n:extract`/`i18n:compile`, not hand-edited)

**Estimated scope:** Small (2–3 files, plus generated i18n output)

---

## Task 5: Cypress end-to-end coverage

**Description:** Add `packages/editor/cypress/e2e/search-node.cy.ts` following the `zoom.cy.ts` pattern: visit `/map-render/html/editor.html`, wait for load via `cy.waitEditorLoaded()`, open the search popover via its `aria-label`, type a query matching a known topic in the fixture map, click the result, and assert the target topic is focused/visible (e.g. via a `data-testid`/selection class on its outer shape, following the `Relationship.ts` `setTestId` precedent) rather than asserting on raw viewport pixel math.

**Acceptance criteria:**

- [ ] A passing Cypress spec covers: open via toolbar click → type → click result → node selected/visible
- [ ] A second case covers: open via `Ctrl/Cmd+Shift+F` keyboard shortcut instead of the toolbar button, reaching the same end state
- [ ] A third case covers the no-results empty state (search for text guaranteed not to exist in the fixture map)

**Verification:**

- [ ] Tests pass: `yarn workspace @wisemapping/editor test:integration`
- [ ] Build succeeds: `yarn build` (root, all packages — final full-repo check before calling the feature done)
- [ ] Manual check: none beyond the automated spec — this task's entire purpose is the automated check

**Dependencies:** Task 3, Task 4

**Files likely touched:**

- `packages/editor/cypress/e2e/search-node.cy.ts` (new)

**Estimated scope:** Small (1 file)

## Risks and Mitigations

| Risk                                                                                                                | Impact     | Mitigation                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Ctrl/Cmd+Shift+F` still collides with a browser or OS-level shortcut in some environment                           | Low–Medium | Chosen because grep confirmed it's unused in-app; document the exact combo in Task 4's PR description so it's easy to change in one place (the keydown switch) if a real collision is reported                                          |
| Extracting shared logic out of `DesignerKeyboard` in Task 2 introduces a regression in existing keyboard navigation | Medium     | Task 2's acceptance criteria explicitly require the pre-refactor keyboard-nav behavior to be re-verified, not just the new `revealNode` path; keep the refactor to a pure extraction (no logic changes) to minimize risk                |
| Large maps make client-side substring filtering feel slow                                                           | Low        | No evidence this is a real problem at current typical map sizes (architecture decision above); revisit with debouncing only if reported                                                                                                 |
| i18n compile step forgotten, shipping only English strings correctly                                                | Low        | Task 4's verification step explicitly runs `i18n:extract`/`i18n:compile`; `editor`'s `build` script already runs `i18n:compile` automatically, so a normal build would catch a missing key at build time if extraction wasn't run first |

## Open Questions

- Should search match only topic _text_, or also topic _notes_ (mindplot topics can carry a note/comment)? This plan scopes to text-only, matching the literal request ("search map node"); notes search would be a follow-up feature, not folded in here.
- Should the search list show a breadcrumb/ancestor path when multiple topics share similar text (e.g. two sibling branches both containing a node labeled "Details")? Task 3's acceptance criteria leave this as an implementer's UX call rather than a hard requirement — flag for human review during Task 3's checkpoint if it turns out to matter in practice.
