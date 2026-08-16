export interface VersionResult {
  fullName: string;
  latest: string | null;
}

/**
 * A fetcher that resolves a package's published `latest` version, or null
 * when the package cannot be resolved (network failure, 404, bad payload).
 * Injectable so the pooling logic is testable without a network.
 */
export type VersionFetcher = (
  fullName: string,
  url: string,
  signal: AbortSignal,
) => Promise<{ version?: string } | null>;

const REGISTRY = "https://registry.npmjs.org/";
const TIMEOUT_MS = 8000;

/** `@scope/name` → `@scope%2fname` (the `/` inside scoped names is encoded). */
export function encodeScopedName(fullName: string): string {
  return fullName.replace("/", "%2f");
}

/** https://registry.npmjs.org/<encoded-name>/latest (only the `/` is encoded). */
export function registryUrl(fullName: string): string {
  return `${REGISTRY}${encodeScopedName(fullName)}/latest`;
}

/**
 * Check the latest published version for each package, bounded to
 * `concurrency` (default 6) in-flight requests. Per-package failures become
 * `latest: null` — one bad request never fails the batch.
 */
export async function fetchLatestVersions(
  fullNames: string[],
  fetcher: VersionFetcher = defaultFetcher,
  concurrency = 6,
): Promise<VersionResult[]> {
  const results: VersionResult[] = [];
  let next = 0;

  const workers = Array.from({ length: Math.min(concurrency, fullNames.length) }, async () => {
    while (next < fullNames.length) {
      const name = fullNames[next++];
      try {
        const data = await fetcher(name, registryUrl(name), withTimeout(TIMEOUT_MS));
        results.push({ fullName: name, latest: data?.version ?? null });
      } catch {
        results.push({ fullName: name, latest: null });
      }
    }
  });

  await Promise.all(workers);
  return results;
}

async function defaultFetcher(
  _fullName: string,
  url: string,
  signal: AbortSignal,
): Promise<{ version?: string } | null> {
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const data = (await response.json()) as { version?: unknown } | null;
  return typeof data?.version === "string" ? { version: data.version } : null;
}

/** AbortSignal that fires after `ms`; falls back to a manual controller. */
function withTimeout(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}