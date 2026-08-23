import { describe, expect, it } from "vitest";
import { toBase64 } from "@/utils/zip";
import { buildSrcDoc, decodeAsset, type PreviewInput } from "./preview";

function doc(input: Partial<PreviewInput> & { env?: PreviewInput["env"] }): string {
  return buildSrcDoc({
    jsAssets: input.jsAssets ?? [],
    html: input.html,
    env: input.env ?? { vars: {}, mount: "", interceptNetwork: true },
  });
}

describe("preview sandbox", () => {
  it("toBase64/fromBase64 round-trips UTF-8 source", () => {
    const src = 'console.log("héllo ☃");\nconst x = 1;';
    const b64 = toBase64(new TextEncoder().encode(src));
    expect(decodeAsset(b64)).toBe(src);
  });

  it("JS-entry mode injects bridge, env vars and the asset source", () => {
    const d = doc({
      jsAssets: ['console.log("hi")'],
      env: { vars: { NODE_ENV: "production" }, mount: "#app", interceptNetwork: true },
    });
    expect(d).toContain("__bsPreview");
    expect(d).toContain('window.__BS_ENV__ = {"NODE_ENV":"production"}');
    expect(d).toContain('id="app"');
    expect(d).toContain("Blob");
  });

  it("HTML-entry mode renders the HTML and injects JS as module scripts", () => {
    const html =
      "<!doctype html><html><head><title>App</title></head><body><div id='root'></div></body></html>";
    const d = doc({ html, jsAssets: ["import './app'"] });
    expect(d).toContain("<title>App</title>");
    expect(d).toContain("<script type=\"module\">\nimport './app'\n</script>");
    expect(d).toContain("__bsPreview");
  });

  it("HTML-entry injects the bridge into <head> and JS before </body>", () => {
    const html = "<html><head></head><body><p>hi</p></body></html>";
    const d = doc({ html, jsAssets: ["console.log(1)"] });
    const headIdx = d.indexOf("</head>");
    const bodyIdx = d.indexOf("</body>");
    expect(d.indexOf("__bsNet")).toBeLessThan(headIdx);
    expect(d.indexOf("console.log(1)")).toBeLessThan(bodyIdx);
    expect(d.indexOf("console.log(1)")).toBeGreaterThan(headIdx);
  });

  it("injects the network interception shim when interceptNetwork is on", () => {
    const d = doc({ jsAssets: [" "], env: { vars: {}, mount: "", interceptNetwork: true } });
    expect(d).toContain("__bsNet");
    expect(d).toContain("window.fetch = function");
    expect(d).toContain("network request blocked");
    expect(d).toContain("__bsEmitProfile");
    expect(d).toContain("var INTERCEPT = true");
  });

  it("omits network blocking when interceptNetwork is false", () => {
    const d = doc({ jsAssets: [" "], env: { vars: {}, mount: "", interceptNetwork: false } });
    expect(d).toContain("var INTERCEPT = false");
  });
});
