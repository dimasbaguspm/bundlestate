/**
 * In-browser Preview Sandbox plumbing (PRD §4.6).
 *
 * Builds an isolated iframe document (via `srcdoc`) that executes a dropped
 * bundle asset, captures its console output + runtime errors through a
 * postMessage bridge, and lets the host inject environment variables and DOM
 * mount points before mount. The iframe is origin-isolated (sandbox attribute)
 * so it cannot reach BundleState's state, storage, or network beyond what we
 * explicitly proxy.
 */

export interface PreviewConsoleEntry {
  level: "log" | "info" | "warn" | "error";
  text: string;
  at: number;
}

export interface PreviewEnv {
  /** import.meta.env / process.env overrides, e.g. { NODE_ENV: "production" }. */
  vars: Record<string, string>;
  /** CSS selector or id for the mount node; "" → auto-created #app root. */
  mount: string;
}

const BRIDGE = `
<script>
(function () {
  var send = function (level, args) {
    try {
      var text = Array.prototype.map.call(args, function (a) {
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch (e) { return String(a); }
      }).join(' ');
      parent.postMessage({ __bsPreview: true, level: level, text: text, at: Date.now() }, '*');
    } catch (e) {}
  };
  ['log', 'info', 'warn', 'error'].forEach(function (lvl) {
    var orig = console[lvl] ? console[lvl].bind(console) : function () {};
    console[lvl] = function () { send(lvl, arguments); orig.apply(null, arguments); };
  });
  window.addEventListener('error', function (e) {
    send('error', [e.message + (e.filename ? ' (' + e.filename + ':' + e.lineno + ')' : '')]);
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason; send('error', ['Unhandled rejection: ' + (r && r.message ? r.message : String(r))]);
  });
  parent.postMessage({ __bsPreview: true, level: 'log', text: '[sandbox] bundle mounted', at: Date.now() }, '*');
})();
</script>`;

/** Decode a base64 asset source back to a UTF-8 string. */
export function decodeAsset(rawBytes: string): string {
  if (typeof atob === "function") {
    const bin = atob(rawBytes);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(out);
  }
  // Node fallback (tests / SSR)
  return Buffer.from(rawBytes, "base64").toString("utf-8");
}

/**
 * Compose the iframe `srcdoc`. Injects the console bridge, a mount node, the
 * env shim (import.meta.env + process.env), and finally the asset source.
 */
export function buildSrcDoc(source: string, env: PreviewEnv): string {
  const varsJson = JSON.stringify(env.vars ?? {});
  const mountId = env.mount?.trim()
    ? env.mount.trim().replace(/^#/, "")
    : "bs-root";

  const envShim = `
<script>
  window.__BS_ENV__ = ${varsJson};
  (function () {
    var vars = window.__BS_ENV__ || {};
    window.process = window.process || {};
    window.process.env = Object.assign({}, vars, window.process.env || {});
    // import.meta doesn't exist at runtime in an iframe; expose a shim module.
    window.__importMetaEnv__ = vars;
  })();
</script>`;

  const mountHtml = `<div id="${mountId}"></div>`;

  const runner = `
<script>
  (function () {
    var src = ${JSON.stringify(source)};
    var mount = document.getElementById(${JSON.stringify(mountId)});
    try {
      var blob = new Blob([src], { type: 'text/javascript' });
      var url = URL.createObjectURL(blob);
      var s = document.createElement('script');
      s.src = url; s.type = 'module';
      s.onerror = function (e) { parent.postMessage({ __bsPreview: true, level: 'error', text: 'Failed to execute bundle: ' + (e.message || e), at: Date.now() }, '*'); };
      document.body.appendChild(s);
    } catch (e) {
      parent.postMessage({ __bsPreview: true, level: 'error', text: 'Failed to execute bundle: ' + (e && e.message ? e.message : String(e)), at: Date.now() }, '*');
    }
  })();
</script>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;margin:0;padding:8px}#${mountId}{min-height:40px}</style>${BRIDGE}${envShim}</head><body>${mountHtml}${runner}</body></html>`;
}
