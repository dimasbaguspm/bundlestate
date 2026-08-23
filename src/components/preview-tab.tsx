import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCw, ShieldAlert, Activity } from "lucide-react";
import { btn, btnActive, btnPrimary, inputCls } from "@/components/ui";
import {
  buildSrcDoc,
  decodeAsset,
  type PreviewConsoleEntry,
  type PreviewEnv,
  type PreviewNetCall,
  type PreviewProfile,
} from "@/lib/preview";
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
  const [intercept, setIntercept] = useState(true);
  const [env, setEnv] = useState<PreviewEnv>({
    vars: { NODE_ENV: "production" },
    mount: "",
    interceptNetwork: true,
  });
  const [console_, setConsole] = useState<PreviewConsoleEntry[]>([]);
  const [netCalls, setNetCalls] = useState<PreviewNetCall[]>([]);
  const [profile, setProfile] = useState<PreviewProfile | null>(null);
  const [nonce, setNonce] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const asset = jsAssets[selected];
  const srcDoc = useMemo(() => {
    if (!asset) return "";
    return buildSrcDoc(decodeAsset(asset.rawBytes), env);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, env, nonce]);

  // Console / network / profile bridge from the sandbox iframe.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d) return;
      if (d.__bsPreview) {
        setConsole((prev) => [...prev, { level: d.level, text: d.text, at: d.at }]);
      } else if (d.__bsNet) {
        setNetCalls((prev) => [...prev, { method: d.method, url: d.url, blocked: d.blocked, at: d.at }]);
      } else if (d.__bsProfile) {
        setProfile({
          mountMs: d.mountMs,
          netCalls: d.netCalls,
          blockedNet: d.blockedNet,
          resources: d.resources,
          longTasks: d.longTasks,
          errors: d.errors,
          at: d.at,
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Reset state when the selected asset or env remounts.
  useEffect(() => {
    setConsole([]);
    setNetCalls([]);
    setProfile(null);
  }, [srcDoc]);

  const remount = () => setNonce((n) => n + 1);

  const applyVar = () => {
    if (!varKey.trim()) return;
    setEnv((e) => ({ ...e, vars: { ...e.vars, [varKey.trim()]: varVal } }));
  };

  const toggleIntercept = () => {
    setIntercept((v) => {
      const next = !v;
      setEnv((e) => ({ ...e, interceptNetwork: next }));
      return next;
    });
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
        <button
          type="button"
          className={`${btn} ${intercept ? btnActive : ""}`}
          onClick={toggleIntercept}
          aria-pressed={intercept}
        >
          <ShieldAlert size={14} aria-hidden /> Network {intercept ? "blocked" : "allowed"}
        </button>
        <button type="button" className={btnPrimary} onClick={remount}>
          <RotateCw size={14} aria-hidden /> Remount
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[1fr_320px]">
        {/* Sandbox */}
        <div className="flex min-h-0 flex-col gap-1">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-dim">
            <span>Sandbox</span>
            <span className="text-faint">isolated iframe · network {intercept ? "egress blocked" : "egress allowed"}</span>
          </div>
          <iframe
            ref={iframeRef}
            title="Bundle preview sandbox"
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            className="min-h-0 flex-1 w-full rounded-lg border border-edge bg-white"
          />
        </div>

        {/* Config + console + profile */}
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

          {/* Execution profiler (§4.6.3) */}
          <div className="rounded-lg border border-edge bg-well p-2">
            <div className="mb-1 flex items-center gap-1 text-[11px] uppercase tracking-wide text-dim">
              <Activity size={12} aria-hidden /> Execution profile
            </div>
            {profile ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[12px]">
                <Stat label="mount" value={`${profile.mountMs} ms`} />
                <Stat label="net calls" value={`${profile.netCalls}${profile.blockedNet ? ` (${profile.blockedNet}⛔)` : ""}`} />
                <Stat label="resources" value={String(profile.resources)} />
                <Stat label="long tasks" value={String(profile.longTasks)} />
                <Stat label="errors" value={String(profile.errors)} tone={profile.errors > 0 ? "danger" : "ok"} />
              </div>
            ) : (
              <span className="text-faint">Profiling… remount to re-run.</span>
            )}
            {netCalls.length > 0 && (
              <div className="mt-2 border-t border-edge pt-1">
                <div className="text-[11px] uppercase tracking-wide text-dim">Network attempts</div>
                <div className="mt-1 max-h-24 overflow-y-auto font-mono text-[11px]">
                  {netCalls.slice(0, 20).map((n, i) => (
                    <div key={i} className="truncate text-[var(--tint-rose-fg)]" title={n.url}>
                      ⛔ {n.method} {n.url}
                    </div>
                  ))}
                </div>
              </div>
            )}
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "danger" }) {
  const color = tone === "danger" ? "text-[var(--tint-rose-fg)]" : tone === "ok" ? "" : "text-ink";
  return (
    <div>
      <span className="text-faint">{label}: </span>
      <span className={color}>{value}</span>
    </div>
  );
}
