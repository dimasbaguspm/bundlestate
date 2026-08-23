/** Site URL, configurable at build time via VITE_SITE_URL. Defaults to the primary deployment. */
export const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.trim() ||
  "https://bundlestate.dimasbaguspm.dev";

export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
export const SITE_NAME = SITE_HOST.split(".")[0] || SITE_HOST;
