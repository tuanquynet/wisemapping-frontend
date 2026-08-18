# Todo: Search Map Node + Jump to Node

See `tasks/plan.md` for full task descriptions, acceptance criteria, and rationale.

## Phase 1: mindplot foundation

- [x] Task 1: `DesignerModel.findTopicsByText()` search helper (`packages/mindplot/src/components/DesignerModel.ts` + new unit test) — implemented on `DesignerModel` rather than `Designer` per plan.md: it's where `_topics`/`filterSelectedTopics()`/`filterTopicsIds()` already live, and is DOM-free/directly testable without mocking `Designer`'s heavier construction. Callers use `designer.getModel().findTopicsByText(query)`.
- [x] Task 2: `Designer.revealNode()` reveal-and-jump, extracted out of `DesignerKeyboard` (`Designer.ts`, `DesignerKeyboard.ts` + `util/topicVisibility.ts` + test) — the ancestor-walking logic lives in a new `util/topicVisibility.ts` (type-only `Topic` import) rather than inline in `Designer.ts`/`DesignerKeyboard.ts`, because `Designer.ts` transitively imports `WidgetBuilder` -> `SvgImageIcon.ts`'s Vite-only `import.meta.glob`, which breaks under Jest the moment `Designer.ts` is loaded as a value (not just a type). `Designer.revealNode()` itself has no direct unit test (would require a full heavy `Designer` construction with no existing precedent); the underlying `getCollapsedAncestorIds()` logic it depends on is fully unit tested (5 cases). Regression-checked manually: the 2 call sites that never called `_ensureTopicVisible` (central-topic fallback, side-child) were left calling the unchanged `_goToNode` helper, not `revealNode`, to avoid introducing new ancestor-expansion behavior where none existed before.

### Checkpoint 1

- [ ] `yarn workspace @wisemapping/mindplot test:unit` passes
- [ ] No regression in existing `DesignerKeyboard` tests
- [ ] `yarn workspace @wisemapping/mindplot lint` clean
- [ ] Human review before Phase 2

## Phase 2: editor UI (mouse-driven)

- [ ] Task 3: `SearchPane` component + toolbar `ActionConfig` wiring (`packages/editor/src/components/action-widget/pane/search-pane/index.tsx`, `visualization-toolbar/index.tsx`, `lang/en.json`)

### Checkpoint 2

- [ ] Manual smoke test: toolbar search → type → click result → canvas pans/selects, including a node hidden in a collapsed branch
- [ ] Empty-query and no-match states verified
- [ ] `yarn workspace @wisemapping/editor lint` and `build` succeed
- [ ] Human review before Phase 3

## Phase 3: keyboard entry + docs

- [ ] Task 4: `Ctrl/Cmd+Shift+F` shortcut + Keyboard-Shortcuts-Help row + i18n extract/compile

### Checkpoint 3

- [ ] Shortcut opens search popover; does not trigger browser find-in-page (Chrome + Firefox)
- [ ] Keyboard Shortcuts Help dialog lists the new shortcut correctly per platform
- [ ] i18n extract/compile run clean

## Phase 4: end-to-end verification

- [ ] Task 5: Cypress spec `packages/editor/cypress/e2e/search-node.cy.ts` (toolbar path, shortcut path, no-results path)

### Final checkpoint

- [ ] `yarn workspace @wisemapping/editor test:integration` passes
- [ ] `yarn build` (root) succeeds
- [ ] All acceptance criteria in `tasks/plan.md` met
- [ ] Ready for human review
