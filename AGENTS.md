# AGENTS.md (Frontend Repository)

Guidance and repository knowledge for AI assistants working in **`wisemapping-frontend`**.

---

## 1. Repository Overview

`wisemapping-frontend` is a Yarn 4 + Lerna monorepo providing the web application and interactive mind mapping canvas for WiseMapping.

- **Workspace Relationship:** This repository connects to the backend REST API hosted in the sibling repository [`../wisemapping-open-source/`](../wisemapping-open-source/) (specifically `wise-api-bun/`).
- **Communication:** Communicates with the backend exclusively via standard REST endpoints (`/api/restful/*`) using JWT bearer token authentication and WiseMapping XML serialization for mind maps.
- **Root Workspace Guide:** Refer to [`../AGENTS.md`](../AGENTS.md) for full workspace context and integration contracts.

---

## 2. Package Hierarchy & Architecture

The repository is organized under `packages/*` as a strictly layered, bottom-up stack. Changes made to lower layers must be rebuilt before consumers can reflect them:

```
┌─────────────────────────────────────────────────────────────┐
│                       packages/webapp                       │
│  The top-level React app (Vite, React Router 7, MUI v9)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ consumes
┌──────────────────────────────▼──────────────────────────────┐
│                       packages/editor                       │
│  React wrapper component around mindplot (Vite UMD+ESM lib) │
└──────────────────────────────┬──────────────────────────────┘
                               │ consumes
┌──────────────────────────────▼──────────────────────────────┐
│                      packages/mindplot                      │
│  Vanilla ES6/TS canvas engine rendering & editing mind maps  │
└──────────────────────────────┬──────────────────────────────┘
                               │ consumes
┌──────────────────────────────▼──────────────────────────────┐
│                       packages/web2d                        │
│  Low-level SVG rendering abstraction (pure DOM & SVG)       │
└─────────────────────────────────────────────────────────────┘
```

### Package Descriptions

1. **`packages/web2d`**: Thin SVG abstraction layer providing primitives (elements, groups, arcs, lines, text). Zero React dependencies.
2. **`packages/mindplot`**: Core canvas rendering and manipulation library. Handles mindmap nodes, relationships, drag-and-drop, layout algorithms, zooming, and XML parsing/serialization. Vanilla TypeScript/ES6.
3. **`packages/editor`**: React component wrapper around `mindplot`. Exposes the visual editor toolbar, dialogs, property inspectors, and history buttons. Built with Vite into `dist/editor.{es,umd}.js`.
4. **`packages/webapp`**: The deployable single-page application. Handles user authentication, dashboard, mindmap listing/filtering, sharing dialogues, account settings, and embedding.

### Additional Infrastructure

- `middleware.ts`: Vercel Edge middleware that intercepts `/c/maps/:id/public` and proxies/handles 410 (deleted map) status against `API_URL`.
- `api/sitemap.ts`: Vercel serverless sitemap handler.
- `vercel.json`: Vercel deployment configuration.

---

## 3. Tech Stack & Environment

- **Node.js:** `>=24` required (see `package.json` engines). **Warning:** Do NOT use `.nvmrc` blindly (it contains a stale reference to Node 16).
- **Package Manager:** Yarn 4 (`yarn@4.13.0`) with corepack / PnP disabled (node-modules linker).
- **Monorepo Tool:** Lerna v8 (`lerna run ...`).
- **Build Tool:** Vite across packages.
- **UI & Styling:** React 18, Material UI (MUI) v9, Emotion, styled-components.
- **State & Data Fetching:** TanStack React Query.
- **Routing:** React Router 7.
- **Testing:** Jest, Cypress (image snapshot and end-to-end), Storybook integration.

---

## 4. Essential Commands

Run from the repository root unless noted:

```sh
# Dependencies & Setup
yarn install

# Monorepo Build & Quality
yarn build                                       # Build all packages in dependency order
yarn lint                                        # ESLint across all packages
yarn lint:fix                                    # ESLint with automatic fixes
yarn test                                        # Run all unit and integration tests
yarn test:unit                                   # Unit tests only
yarn test:integration                            # Cypress integration tests via Storybook

# Individual Packages
yarn workspace @wisemapping/webapp dev          # Run webapp Vite dev server on :3000
yarn workspace @wisemapping/editor build        # Rebuild editor library
yarn workspace @wisemapping/mindplot test:unit  # Run mindplot unit tests

# Storybook & Visual Playgrounds
yarn workspace @wisemapping/editor playground   # Vite playground for editor components
yarn workspace @wisemapping/mindplot storybook  # Storybook for mindmap canvas inspection
yarn workspace @wisemapping/web2d storybook     # Storybook for web2d SVG primitives

# Running a Single Jest Test
cd packages/mindplot && yarn jest test/unit/path/to/test.ts
```

---

## 5. Internationalization (i18n)

Both `editor` and `webapp` use `react-intl` with FormatJS AST compilation:

- **Source of truth:** `lang/en.json` in each package.
- **Compiled outputs:** `src/compiled-lang/*.json` (committed to git; do not edit directly).
- **Workflow to update translations:**
  ```sh
  yarn workspace @wisemapping/editor i18n:extract   # Extract messages from source into en.json
  yarn workspace @wisemapping/editor i18n:compile   # Compile locales into src/compiled-lang/
  ```
- **Adding a locale:** Hardcoded in the package `i18n:compile` scripts (editor and webapp); both must be updated when a new language is introduced.

---

## 6. Integration with the Backend API

1. **Configuring Backend URL:**
   - In local development, the webapp targets `http://localhost:8080` (or the URL defined in environment variable `API_URL`).
2. **Authentication Flow:**
   - Client sends login requests to `POST /api/restful/authenticate`.
   - Reads the returned JWT token and stores it in application state.
   - Attaches `Authorization: Bearer <token>` to all protected calls.
3. **Mindmap Document Sync:**
   - Loads XML data via `GET /api/restful/maps/{id}/document/xml`.
   - Saves XML data via `PUT /api/restful/maps/{id}/document/xml`.
   - Acquired lock status is checked via `/metadata` or lock endpoints.

---

## 7. Known Pitfalls & Boundaries for AI Agents

| Pitfall                       | Rule                                                                                                                                                   |
| :---------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node Version Mismatch**     | Always use Node `>=24`. The repository has a stale `.nvmrc` (v16) — do not rely on it.                                                                 |
| **Dependency Build Order**    | Edits in `web2d` or `mindplot` are not immediately visible in `editor` or `webapp` until you run `yarn workspace @wisemapping/<pkg> build`.            |
| **Compiled Language Files**   | Never edit `src/compiled-lang/*.json` by hand. Always edit `lang/en.json` (or target locale) and run `yarn workspace @wisemapping/<pkg> i18n:compile`. |
| **Cypress Image Snapshots**   | Visual snapshots are OS-sensitive (font rendering varies between macOS, Linux, and Windows). Check image diffs carefully.                              |
| **Ghost `webpack.common.js`** | Referenced in some ESLint configs and Husky hook paths as a legacy artifact; do not create or attempt to fix it.                                       |
| **Pre-push Husky Hook**       | `.husky/pre-push` validates packages affected by git diffs. Ensure affected package tests pass before pushing.                                         |
