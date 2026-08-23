import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { btn, btnActive, btnPrimary, inputCls } from "@/components/ui";
import { buildSrcDoc, decodeAsset, type PreviewConsoleEntry, type PreviewEnv } from "@/lib/preview";
import type { BundleStateReport } from "@/lib/types";

/** Preview Sandbox tab (PRD §4.6): run a dropped JS asset in an isolated iframe. */
export function PreviewTab({ report }: { report: BundleStateReport }) {
  const jsAssets = useMemo(
    () => report.assets.filter((a) => a.kind === "js" && a.rawBytes),
    [report],
  );
  const [selected, setSelected] = useState(0);
  const [mount, setMount] = useState("");
  const [varKey, setVarKey] = useState("NODE_ENV");
  const [varVal, setVarVal] = useState("production");
  const [env, setEnv] = useState<PreviewEnv>({ vars: { NODE_ENV: "production" }, mount: "" });
  const [console_, setConsole] = useState<PreviewConsoleEntry[]>([]);
  const [nonce, setNonce] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const asset = jsAssets[selected];
  const srcDoc = useMemo(() => {
    if (!asset) return "";
    return buildSrcDoc(decodeAsset(asset.rawBytes), env);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, env, nonce]);

  // Console bridge: listen for messages from the sandbox iframe.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (d && d.__bsPreview) {
        setConsole((prev) => [...prev, { level: d.level, text: d.text, at: d.at }]);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Reset console when the selected asset or env remounts.
  useEffect(() => {
    setConsole([]);
  }, [srcDoc]);

  const remount = () => setNonce((n) => n + 1);

  const applyVar = () => {
    if (!varKey.trim()) return;
    setEnv((e) => ({ ...e, vars: { ...e.vars, [varKey.trim()]: varVal } }));
  };

  if (jsAssets.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-dim">
        <p className="text-sm">No JS assets with source to preview.</p>
        <p className="text-xs text-faint">Drop a build zip that includes raw .js assets.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Preview asset" className="flex items-center rounded-lg border border-edge bg-surface-2 p-0.5">
          {jsAssets.map((a, i) => (
            <button
              key={a.name}
              type="button"
              role="tab"
              aria-selected={i === selected}
              className={`px-2.5 py-1 text-xs ${btn} ${i === selected ? btnActive : ""}`}
              onClick={() => setSelected(i)}
            >
              {a.name.split("/").pop()}
            </button>
          ))}
        </div>
        <button type="button" className={btnPrimary} onClick={remount}>
          <RotateCw size={14} aria-hidden /> Remount
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[1fr_300px]">
        {/* Sandbox */}
        <div className="flex min-h-0 flex-col gap-1">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-dim">
            <span>Sandbox</span>
            <span className="text-faint">isolated iframe · no network / storage access</span>
          </div>
          <iframe
            ref={iframeRef}
            title="Bundle preview sandbox"
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            className="min-h-0 flex-1 w-full rounded-lg border border-edge bg-white"
          />
        </div>

        {/* Config + console */}
        <div className="flex min-h-0 flex-col gap-2">
          <div className="rounded-lg border border-edge bg-well p-2">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-dim">Env vars (import.meta.env / process.env)</div>
            <div className="mb-1 flex flex-wrap gap-1">
              {Object.entries(env.vars).map(([k, v]) => (
                <span key={k} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink">
                  {k}={v}
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input value={varKey} onChange={(e) => setVarKey(e.target.value)} placeholder="KEY" aria-label="env key" className={inputCls} />
              <input value={varVal} onChange={(e) => setVarVal(e.target.value)} placeholder="value" aria-label="env value" className={inputCls} />
              <button type="button" className={btn} onClick={applyVar}>Add</button>
            </div>
            <div className="mt-1 text-[11px] text-dim">Mount node</div>
            <input value={mount} onChange={(e) => { setMount(e.target.value); setEnv((x) => ({ ...x, mount: e.target.value })); }} placeholder="#app or leave blank for #bs-root" aria-label="mount node" className={inputCls} />
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-edge bg-well">
            <div className="border-b border-edge px-2 py-1 text-[11px] uppercase tracking-wide text-dim">Sandbox console</div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2 font-mono text-[12px]">
              {console_.length === 0 ? (
                <span className="text-faint">No output yet — remount to run.</span>
              ) : (
                console_.map((c, i) => (
                  <div key={i} className={c.level === "error" ? "text-[var(--tint-rose-fg)]" : c.level === "warn" ? "text-[var(--tint-amber-fg)]" : "text-ink"}>
                    <span className="text-faint">{new Date(c.at).toLocaleTimeString()} </span>
                    {c.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
