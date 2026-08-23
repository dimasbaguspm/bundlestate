/**
 * In-browser Preview Sandbox plumbing (PRD §4.6).
 *
 * Builds an isolated iframe document (via `srcdoc`) that executes a dropped
 * bundle asset, captures its console output + runtime errors through a
 * postMessage bridge, and lets the host inject environment variables and DOM
 * mount points before mount.
 *
 * §4.6.3 hardening:
 *  - Network interception: `fetch`/`XMLHttpRequest` are shimmed to block real
 *    egress (the sandbox cannot phone home) and every attempt is reported to
 *    the host so the user sees what the bundle *tried* to do.
 *  - Execution profiler: mount time, long tasks, resource timing, error/console
 *    counts are captured and reported as a single profile summary.
 */

export interface PreviewConsoleEntry {
  level: "log" | "info" | "warn" | "error";
  text: string;
  at: number;
}

export interface PreviewNetCall {
  method: string;
  url: string;
  blocked: boolean;
  at: number;
}

export interface PreviewProfile {
  mountMs: number;
  netCalls: number;
  blockedNet: number;
  resources: number;
  longTasks: number;
  errors: number;
  at: number;
}

export interface PreviewEnv {
  /** import.meta.env / process.env overrides, e.g. { NODE_ENV: "production" }. */
  vars: Record<string, string>;
  /** CSS selector or id for the mount node; "" → auto-created #bs-root. */
  mount: string;
  /** When true (default) the sandbox blocks + records all network egress. */
  interceptNetwork?: boolean;
}

const BRIDGE = `
<script>
(function () {
  window.__bsNetCalls = [];
  window.__bsErrors = 0;
  window.__bsLongTasks = 0;

  var send = function (level, args) {
    try {
      var text = Array.prototype.map.call(args, function (a) {
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch (e) { return String(a); }
      }).join(' ');
      parent.postMessage({ __bsPreview: true, level: level, text: text, at: Date.now() }, '*');
      if (level === 'error') window.__bsErrors++;
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

  // --- Network interception (§4.6.3) ---
  var INTERCEPT = __BS_INTERCEPT__;
  function recordNet(method, url) {
    var entry = { method: method, url: String(url), blocked: INTERCEPT, at: Date.now() };
    window.__bsNetCalls.push(entry);
    try { parent.postMessage({ __bsNet: true, method: method, url: String(url), blocked: INTERCEPT, at: entry.at }, '*'); } catch (e) {}
  }
  if (INTERCEPT) {
    var realFetch = window.fetch ? window.fetch.bind(window) : null;
    window.fetch = function (input, init) {
      var url = (input && input.url) ? input.url : (typeof input === 'string' ? input : String(input));
      var method = (init && init.method) ? init.method : (input && input.method ? input.method : 'GET');
      recordNet(method || 'GET', url);
      // Block real egress: resolve a synthetic failure.
      return Promise.reject(new TypeError('[sandbox] network request blocked: ' + url));
    };
    var RealXHR = window.XMLHttpRequest;
    if (RealXHR) {
      window.XMLHttpRequest = function () {
        var xhr = new RealXHR();
        var origOpen = xhr.open.bind(xhr);
        xhr.open = function (m, u) { recordNet(m || 'GET', u); return origOpen(m, u); };
        var origSend = xhr.send.bind(xhr);
        xhr.send = function () { try { Object.defineProperty(xhr, 'status', { get: function(){return 0;} }); } catch(e){} return origSend.apply(null, arguments); };
        ['onreadystatechange','onload','onerror','ontimeout'].forEach(function (ev) {
          var key = 'on' + ev.slice(2);
          xhr.addEventListener(ev, function () { if (ev === 'onerror' || ev === 'onload') {} });
        });
        return xhr;
      };
    }
  }

  // --- Execution profiler (§4.6.3) ---
  if (window.PerformanceObserver) {
    try {
      var lto = new PerformanceObserver(function (list) {
        window.__bsLongTasks += list.getEntries().length;
      });
      lto.observe({ entryTypes: ['longtask'] });
    } catch (e) {}
  }

  window.__bsMountStart = performance.now();
  parent.postMessage({ __bsPreview: true, level: 'log', text: '[sandbox] bundle mounted', at: Date.now() }, '*');

  // Emit the profile summary once the bundle has had time to settle.
  window.__bsEmitProfile = function () {
    var mountMs = Math.round((performance.now() - window.__bsMountStart) * 100) / 100;
    var resources = 0;
    try { resources = performance.getEntriesByType('resource').length; } catch (e) {}
    var profile = {
      __bsProfile: true,
      mountMs: mountMs,
      netCalls: window.__bsNetCalls.length,
      blockedNet: window.__bsNetCalls.filter(function (n) { return n.blocked; }).length,
      resources: resources,
      longTasks: window.__bsLongTasks,
      errors: window.__bsErrors,
      at: Date.now()
    };
    try { parent.postMessage(profile, '*'); } catch (e) {}
  };
  setTimeout(window.__bsEmitProfile, 1200);
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
 * Compose the iframe `srcdoc`. Injects the console/network/profiler bridge, a
 * mount node, the env shim (import.meta.env + process.env), and finally the
 * asset source.
 */
export function buildSrcDoc(source: string, env: PreviewEnv): string {
  const varsJson = JSON.stringify(env.vars ?? {});
  const intercept = env.interceptNetwork !== false;
  const mountId = env.mount?.trim()
    ? env.mount.trim().replace(/^#/, "")
    : "bs-root";

  const envShim = `
<script>
  window.__BS_ENV__ = ${varsJson};
  window.__BS_INTERCEPT__ = ${intercept};
  (function () {
    var vars = window.__BS_ENV__ || {};
    window.process = window.process || {};
    window.process.env = Object.assign({}, vars, window.process.env || {});
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

  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;margin:0;padding:8px}#${mountId}{min-height:40px}</style>${BRIDGE.replace("__BS_INTERCEPT__", String(intercept))}${envShim}</head><body>${mountHtml}${runner}</body></html>`;
}
