# BundleState — Greenfield Scaffold Brief

Build the initial working skeleton of a new client-side SPA in this repo. You are the coding worker; the architecture is locked. Do NOT redesign — implement exactly this.

## Product (one line)
100% client-side, zero-network diagnostic dashboard: user drag-drops a **zip** of their built JS bundle (which must include source maps), we extract it in a Web Worker, and visualize the bundle + which packages (incl. transitive deps) the app actually ships, flagging bloat and dependency drift. Nothing leaves the browser.

## Locked stack (do not deviate)
- React 18 + TypeScript + **Vite**
- **pnpm**, Node 24 (pin via `mise.toml`; `mise use node@24 pnpm@10`), `.node-version`
- **oxlint** (lint) + **oxfmt** (format): scripts `lint`, `fmt`, `fmt:check`
- **vitest** for unit tests (+ `@testing-library/react`, jsdom)
- **zustand** for state, **lucide-react** icons, **clsx**
- **comlink** for worker class proxies, **fflate** for zip extraction
- **Apache ECharts** (echarts + echarts-for-react or direct) for the treemap
- Tailwind **v4** CSS-first (no tailwind.config.js). Theme: dark-green base + gold ink per the standard dimasbaguspm design system (see SKILL.md theme). Deps: `tailwindcss` + `@tailwindcss/vite`, `@import "tailwindcss";` + `@theme inline` mapping semantic vars.
- Conventional Commits.
- Mandatory `.devcontainer/devcontainer.json` (build Dockerfile, `forwardPorts`=dev port 5173, postCreateCommand installs deps via corepack enable pnpm + `pnpm install`, `remoteUser: node`, pnpm-store volume).
- `semantic-release` configured: `.releaserc.json` with `tagFormat:"bundlestate_v${version}"`, `conventionalcommits` preset, `npmPublish:false`. GH Actions `release.yml` on push to main. Plus a `deploy.yml` (or in release) that builds and deploys to **GitHub Pages** (`vite build` output to `dist`, actions/deploy-pages).
- `.gitignore` for node_modules/dist/.env.

## Worker architecture (implement the skeleton, wire real code)
```
Main thread
 └── AppWorkerPool        # orchestrates multiple zip uploads
      └── ParseWorker[i]  # one per dropped zip
           ├─ ReadableStream on the zip file (progress + abort)
           ├─ fflate unzip (extract entries, no paths sent anywhere)
           ├─ AutoDetect  # identify bundler from structure
           └─ NormalizeSubWorker  # build tree + compute gzip (CompressionStream) + insights
```
- comlink proxies the normalizer class across both worker hops.
- zustand store holds the normalized `BundleStateReport` (plain object, no serialization issue).

## Entry UX (MVP)
- Single landing page with a drag-and-drop zip dropzone (HTML5 File API). No folder picker, no metafile single-file mode.
- Requires `.map` files to be present in the zip (inline `//# sourceMappingURL=data:application/json;base64,...` OR sidecar `<file>.map`). Parse both.
- Progress bar during extraction/parse; allow abort.

## Unified data model (implement the types)
```
BundleStateReport { id, sourceName, generatedAt, assets[], packages[], declaredDeps, lockfile, graph }
Asset { name, sizeBytes, gzipBytes, usedModules: string[] }   // usedModules from .map.sources
Package { name, scope?, version?, source: 'webpack'|'pnpm'|'unknown', usedIn: string[] }
graph { appToPkg: Record<string,string[]>, pkgToSubPkg: Record<string,string[]> }  // transitive from lockfile
```
Package-name resolution from module paths: `node_modules/<pkg>/...`, scoped `node_modules/@scope/<pkg>/...`, pnpm `.pnpm/<pkg>@<ver>/node_modules/<pkg>/...` (capture version).

## Scope for THIS run (deliver working code + passing tests)
1. Full Vite+React+TS+Tailwind v4 scaffold per conventions (index.css theme, ui.tsx primitives, shell layout).
2. Worker pipeline skeleton: AppWorkerPool, ParseWorker, NormalizeSubWorker with comlink.
3. Zip drag-drop entry + progress + abort; fflate extraction.
4. `.map` detection (inline + sidecar) and `sources` → `usedModules` extraction.
5. Package-name resolver (webpack/pnpm/scoped) with vitest unit tests.
6. Types for the unified model.
7. `.devcontainer`, semantic-release, GH Pages deploy, .gitignore, mise.toml.
8. `pnpm install`, `pnpm lint`, `pnpm test`, `pnpm build` all green. Fix what breaks.

## Deliverable
- All files committed via git on branch `main` (or `chore/scaffold`), Conventional Commit messages.
- Print a short summary: files created, test/lint/build results, and what is stubbed vs real.

## Do not
- Do not add any network calls / backend / analytics.
- Do not add a CLI.
- Do not over-build: skeleton the insights engine, focus on solid scaffold + worker pipeline + entry + model + resolver + tests.
