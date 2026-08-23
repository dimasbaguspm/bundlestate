import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { RotateCw, ShieldAlert, Activity, FileCode2, Plus, X } from "lucide-react";
import { btn, btnActive, btnPrimary, inputCls } from "@/components/ui";
import {
  buildSrcDoc,
  decodeAsset,
  type PreviewConsoleEntry,
  type PreviewEnv,
  type PreviewNetCall,
  type PreviewProfile,
} from "@/modules/preview/lib/preview";
import type { BundleStateReport } from "@/utils/types";

const ENV_PRESETS: Record<string, Record<string, string>> = {
  production: { NODE_ENV: "production", BASE_URL: "/" },
  development: { NODE_ENV: "development", BASE_URL: "/" },
  test: { NODE_ENV: "test", BASE_URL: "/" },
};

/** Preview Sandbox tab (PRD §4.6): render a dropped bundle in an isolated iframe. */
export function PreviewTab() {
  const report = useOutletContext<BundleStateReport>();
  const jsAssets = useMemo(
    () => report.assets.filter((a) => a.kind === "js" && a.rawBytes),
    [report],
  );
  const htmlAssets = useMemo(
    () => report.assets.filter((a) => a.kind === "html" && a.rawBytes),
    [report],
  );

  const [entryKind, setEntryKind] = useState<"html" | "js">(htmlAssets.length > 0 ? "html" : "js");
  const [htmlIndex, setHtmlIndex] = useState(0);
  const [injected, setInjected] = useState<Set<number>>(() => new Set(jsAssets.map((_, i) => i)));
  const [mount, setMount] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({ NODE_ENV: "production" });
  const [intercept, setIntercept] = useState(true);
  const [console_, setConsole] = useState<PreviewConsoleEntry[]>([]);
  const [netCalls, setNetCalls] = useState<PreviewNetCall[]>([]);
  const [profile, setProfile] = useState<PreviewProfile | null>(null);
  const [nonce, setNonce] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const env: PreviewEnv = useMemo(
    () => ({ vars, mount, interceptNetwork: intercept }),
    [vars, mount, intercept],
  );

  const srcDoc = useMemo(() => {
    const html =
      entryKind === "html" && htmlAssets[htmlIndex]
        ? decodeAsset(htmlAssets[htmlIndex].rawBytes)
        : undefined;
    const js = jsAssets.filter((_, i) => injected.has(i)).map((a) => decodeAsset(a.rawBytes));
    return buildSrcDoc({ html, jsAssets: js, env });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryKind, htmlIndex, injected, env, jsAssets, nonce]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d) return;
      if (d.__bsPreview) {
        setConsole((prev) => [...prev, { level: d.level, text: d.text, at: d.at }]);
      } else if (d.__bsNet) {
        setNetCalls((prev) => [
          ...prev,
          { method: d.method, url: d.url, blocked: d.blocked, at: d.at },
        ]);
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

  useEffect(() => {
    setConsole([]);
    setNetCalls([]);
    setProfile(null);
  }, [srcDoc]);

  const remount = () => setNonce((n) => n + 1);
  const toggleInject = (i: number) =>
    setInjected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const applyPreset = (name: keyof typeof ENV_PRESETS) =>
    setVars({ ...vars, ...ENV_PRESETS[name] });

  if (jsAssets.length === 0 && htmlAssets.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-dim">
        <p className="text-sm">No JS or HTML assets with source to preview.</p>
        <p className="text-xs text-faint">Drop a build zip that includes raw .js / .html assets.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Entry selector */}
        <div
          role="tablist"
          aria-label="Entry type"
          className="flex items-center rounded-lg border border-edge bg-surface-2 p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={entryKind === "html"}
            className={`px-2.5 py-1 text-xs ${btn} ${entryKind === "html" ? btnActive : ""}`}
            onClick={() => setEntryKind("html")}
            disabled={htmlAssets.length === 0}
          >
            <FileCode2 size={14} aria-hidden /> HTML entry
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={entryKind === "js"}
            className={`px-2.5 py-1 text-xs ${btn} ${entryKind === "js" ? btnActive : ""}`}
            onClick={() => setEntryKind("js")}
          >
            JS entry
          </button>
        </div>

        {entryKind === "html" && htmlAssets.length > 0 && (
          <select
            aria-label="HTML entry file"
            className={inputCls}
            value={htmlIndex}
            onChange={(e) => setHtmlIndex(Number(e.target.value))}
          >
            {htmlAssets.map((a, i) => (
              <option key={a.name} value={i}>
                {a.name.split("/").pop()}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          className={`${btn} ${intercept ? btnActive : ""}`}
          onClick={() => setIntercept((v) => !v)}
          aria-pressed={intercept}
        >
          <ShieldAlert size={14} aria-hidden /> Network {intercept ? "blocked" : "allowed"}
        </button>
        <button type="button" className={btnPrimary} onClick={remount}>
          <RotateCw size={14} aria-hidden /> Remount
        </button>
      </div>

      {/* JS asset injection toggles (only meaningful for HTML entry) */}
      {entryKind === "html" && jsAssets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[11px] uppercase tracking-wide text-faint">Inject JS</span>
          {jsAssets.map((a, i) => (
            <button
              key={a.name}
              type="button"
              className={`rounded px-2 py-0.5 text-[11px] ${injected.has(i) ? btnActive : btn}`}
              onClick={() => toggleInject(i)}
            >
              {a.name.split("/").pop()}
            </button>
          ))}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[1fr_320px]">
        {/* Sandbox */}
        <div className="flex min-h-0 flex-col gap-1">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-dim">
            <span>Sandbox</span>
            <span className="text-faint">
              isolated iframe · network {intercept ? "egress blocked" : "egress allowed"}
            </span>
          </div>
          <iframe
            ref={iframeRef}
            title="Bundle preview sandbox"
            sandbox="allow-scripts allow-same-origin"
            srcDoc={srcDoc}
            className="min-h-0 flex-1 w-full rounded-lg border border-edge bg-white"
          />
        </div>

        {/* Config + console + profile */}
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          <div className="rounded-lg border border-edge bg-well p-2">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-dim">
              Environment (changeable)
            </div>
            <div className="mb-1 flex flex-wrap gap-1">
              {Object.keys(ENV_PRESETS).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`rounded px-2 py-0.5 text-[11px] ${btn}`}
                  onClick={() => applyPreset(p as keyof typeof ENV_PRESETS)}
                >
                  {p}
                </button>
              ))}
            </div>
            {Object.entries(vars).map(([k, v]) => (
              <div key={k} className="mb-1 flex items-center gap-1">
                <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink">
                  {k}={v}
                </span>
                <button
                  type="button"
                  aria-label={`remove ${k}`}
                  className="text-faint hover:text-[var(--tint-rose-fg)]"
                  onClick={() =>
                    setVars((prev) => {
                      const n = { ...prev };
                      delete n[k];
                      return n;
                    })
                  }
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <VarAdder onAdd={(k, v) => setVars((prev) => ({ ...prev, [k]: v }))} />
            <div className="mt-1 text-[11px] text-dim">Mount node</div>
            <input
              value={mount}
              onChange={(e) => setMount(e.target.value)}
              placeholder="#app or leave blank for #bs-root"
              aria-label="mount node"
              className={inputCls}
            />
          </div>

          <div className="rounded-lg border border-edge bg-well p-2">
            <div className="mb-1 flex items-center gap-1 text-[11px] uppercase tracking-wide text-dim">
              <Activity size={12} aria-hidden /> Execution profile
            </div>
            {profile ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[12px]">
                <Stat label="mount" value={`${profile.mountMs} ms`} />
                <Stat
                  label="net calls"
                  value={`${profile.netCalls}${profile.blockedNet ? ` (${profile.blockedNet}⛔)` : ""}`}
                />
                <Stat label="resources" value={String(profile.resources)} />
                <Stat label="long tasks" value={String(profile.longTasks)} />
                <Stat
                  label="errors"
                  value={String(profile.errors)}
                  tone={profile.errors > 0 ? "danger" : "ok"}
                />
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
            <div className="border-b border-edge px-2 py-1 text-[11px] uppercase tracking-wide text-dim">
              Sandbox console
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2 font-mono text-[12px]">
              {console_.length === 0 ? (
                <span className="text-faint">No output yet — remount to run.</span>
              ) : (
                console_.map((c, i) => (
                  <div
                    key={i}
                    className={
                      c.level === "error"
                        ? "text-[var(--tint-rose-fg)]"
                        : c.level === "warn"
                          ? "text-[var(--tint-amber-fg)]"
                          : "text-ink"
                    }
                  >
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

function VarAdder({ onAdd }: { onAdd: (k: string, v: string) => void }) {
  const [k, setK] = useState("");
  const [v, setV] = useState("");
  return (
    <div className="mt-1 flex gap-1">
      <input
        value={k}
        onChange={(e) => setK(e.target.value)}
        placeholder="KEY"
        aria-label="new env key"
        className={inputCls}
      />
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="value"
        aria-label="new env value"
        className={inputCls}
      />
      <button
        type="button"
        className={btn}
        onClick={() => {
          if (k.trim()) {
            onAdd(k.trim(), v);
            setK("");
            setV("");
          }
        }}
      >
        <Plus size={12} aria-hidden /> Add
      </button>
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
