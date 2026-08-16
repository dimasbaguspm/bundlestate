/**
 * Structured tracing from inside workers. Console-only: bundle contents never
 * leave the browser, so there is no backend to push to. Every line is prefixed
 * `[bs-worker]` so a devtools filter shows the whole parse→normalize pipeline
 * as it runs, which is what you need when tracing a failed upload.
 */
export function trace(phase: string, detail?: unknown): void {
  // eslint-disable-next-line no-console
  console.log(`[bs-worker:${phase}]`, detail ?? "");
}
