/** Version injected at build time via VITE_APP_VERSION (Docker/CI). Falls back to "Nightly". */
export const APP_VERSION =
  (import.meta.env.VITE_APP_VERSION as string | undefined)?.trim() || "Nightly";
