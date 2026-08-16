# BundleState

<p align="center">
  <img src="public/bundlestate.png" alt="BundleState logo" width="128" />
</p>

Universal, zero-config, client-side **bundle diagnostics** for JavaScript and TypeScript applications. Drag in a build zip (with source maps) and see exactly which packages your app actually ships — including **deps of deps** — with bloat flags and version drift. Nothing leaves your machine.

**Motto:** Know what your bundle actually ships.

## Features

- **Drag-and-drop zip** — no installs, no config. Drop the build output and analysis starts.
- **Source-map powered** — reads inline or sidecar `.map` files to recover the true module graph.
- **Dependency awareness** — every package your app ships, including transitive deps, resolved from real module paths.
- **Version drift** — versions extracted from pnpm virtual-store paths and lockfiles, so you see what actually shipped vs what was declared.
- **Three views** — a zoomable **Treemap** (bigger size = bigger space), a connected **Lineage** dependency graph, and a **Dependencies** tree (deps + deps of deps) that jumps into the graph — each with a live filter for easy debugging.
- **Bloat flags** — gzip sizes per asset and an insights engine that flags unused declared deps and oversized chunks.
- **Privacy-first** — every byte is processed in Web Workers inside your browser. No backend, no analytics, no data exfiltration.

## Stack

React + TypeScript · Vite · Tailwind v4 · Zustand · ECharts · fflate · comlink (Web Workers)
Tooling: pnpm · Node 24 · oxlint · oxfmt · vitest

## Develop

```bash
pnpm install
pnpm dev      # http://localhost:5173
```

## Scripts

| Script | What |
|--------|------|
| `pnpm dev` | dev server |
| `pnpm build` | typecheck + production build |
| `pnpm preview` | serve the production build |
| `pnpm test` | unit tests (vitest) |
| `pnpm lint` | oxlint |
| `pnpm fmt` / `fmt:check` | format / verify |

## Config (build-time env)

| Env | Purpose |
|-----|---------|
| `VITE_APP_VERSION` | version string shown in the footer (default `Nightly`) |
| `VITE_SITE_URL` | canonical site URL used in the footer (default `https://bundlestate.dimasbaguspm.dev`) |

## Layout

```
src/lib/         pure analysis (zip, sourcemap, resolver, lockfile, normalize, insights)
src/workers/     comlink worker pipeline (parse worker + normalize sub worker)
src/state/       zustand store + job orchestration
src/components/  dropzone, jobs panel, treemap/lineage/dependencies tabs, shared UI
```

## Deploy

Two GitHub Actions workflows on push to `main`:

- **CI** — builds a `ghcr.io/dimasbaguspm/bundlestate` image (`<sha>` + `latest`) and fires the `DEPLOY_WEBHOOK_URL` webhook when that secret is set.
- **Release** — `semantic-release` creates a versioned GitHub Release tagged `bundlestate_v<semver>` (e.g. `bundlestate_v1.0.0`) with auto-generated notes from Conventional Commits. Version bumps: `fix` = patch, `feat` = minor, `BREAKING` = major. Run locally with `pnpm release`.