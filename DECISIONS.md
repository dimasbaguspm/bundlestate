# BundleState — Decisions Log

Brainstorm outcomes locked during greenfield kickoff (2026-08-16). Supersedes the original PRD where they conflict.

## Product
100% client-side SPA: user drag-drops a **zip** of a built JS bundle (source maps required), we extract it in a Web Worker, and visualize the bundle plus which packages (incl. transitive deps) the app actually ships. Flags bloat and dependency drift. **Nothing leaves the browser.**

## Locked decisions
| Decision | Choice | Rationale |
|---|---|---|
| Bundle entry | **Zip drag-drop only** (no folder picker, no single metafile mode) | Replaced original PRD's metafile.json formats entirely |
| Source maps | **Required** (inline `data:` base64 OR sidecar `.map`); `sources` → usedModules | Only reliable record of what actually shipped; original PRD "raw source map parsing = non-goal" was **reversed** |
| Zip library | **fflate**, extraction in worker | Fast, dependency-free |
| Streaming | `ReadableStream` on zip for progress + abort; full-string `JSON.parse` in subworker; true incremental parse deferred | MVP scope |
| Worker topology | Main → AppWorkerPool → ParseWorker per zip → NormalizeSubWorker (comlink class proxies, two hops) | Failure isolation + parallel files |
| gzip | `gzipBytes` computed via `CompressionStream('gzip')` in subworker | Works in DedicatedWorker, off-main-thread |
| Version/drift | **Lockfile-only, offline** (package.json + package-lock/pnpm-lock). npm "is there a newer version" = later **explicit opt-in** | Preserves zero-exfil promise; drift is the actionable signal. Dropping a zip consents to local processing only, not sending names to npm |
| Version precision | pnpm paths encode version (`.pnpm/pkg@<ver>/`); webpack paths don't | Handle both |
| State | zustand holds normalized `BundleStateReport` (plain object) | No serialization issue |
| Viz | Apache ECharts treemap; schema kept renderer-agnostic for a future custom Canvas engine | Ship speed |
| Stack | React+TS+Vite, pnpm, Node 24 (mise), oxlint+oxfmt, vitest, Tailwind v4 dark-green/gold, devcontainer, Conventional Commits | dimasbaguspm standard |
| Deploy | GitHub Pages + semantic-release (`bundlestate_v<ver>` tags) | Public repo |

## Unified data model
```
BundleStateReport { id, sourceName, generatedAt, assets[], packages[], declaredDeps, lockfile, graph }
Asset { name, sizeBytes, gzipBytes, usedModules: string[] }      // usedModules from .map.sources
Package { name, scope?, version?, source: 'webpack'|'pnpm'|'unknown', usedIn: string[] }
graph { appToPkg, pkgToSubPkg }                                   // transitive from lockfile
```

## Known limitations (accept for MVP)
- Treemap package value = approximated per-asset split (source maps can't give per-package byte counts).
- `yarn.lock` detected but not parsed (MVP: npm + pnpm lockfiles).
- Insights engine: unused-declared-deps + gzip ratio shipped; heavier heuristics deferred.
- comlink lacks AbortSignal → abort implemented as proxied `isAborted()` poll.

## Deferred (v2 candidates)
- npm registry "latest version" check (explicit opt-in toggle, package names only)
- Streaming/incremental JSON tree building; yarn.lock; custom Canvas renderer; multi-report comparison