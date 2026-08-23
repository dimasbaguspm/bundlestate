import { describe, expect, it } from "vitest";
import { toBase64 } from "./zip";
import { buildSrcDoc, decodeAsset } from "./preview";

describe("preview sandbox", () => {
  it("toBase64/fromBase64 round-trips UTF-8 source", () => {
    const src = 'console.log("héllo ☃");\nconst x = 1;';
    const b64 = toBase64(new TextEncoder().encode(src));
    expect(decodeAsset(b64)).toBe(src);
  });

  it("buildSrcDoc injects the bridge, env vars and the asset source", () => {
    const doc = buildSrcDoc('console.log("hi")', { vars: { NODE_ENV: "production" }, mount: "#app" });
    expect(doc).toContain("__bsPreview");
    expect(doc).toContain('window.__BS_ENV__ = {"NODE_ENV":"production"}');
    expect(doc).toContain('id="app"');
    // the source is embedded as a JSON string and executed as a module script
    expect(doc).toContain('"console.log(\\"hi\\")"');
    expect(doc).toContain("Blob");
  });

  it("injects the network interception shim when interceptNetwork is on", () => {
    const doc = buildSrcDoc(" ", { vars: {}, mount: "", interceptNetwork: true });
    expect(doc).toContain("__bsNet");
    expect(doc).toContain("window.fetch = function");
    expect(doc).toContain("network request blocked");
    expect(doc).toContain("__bsEmitProfile");
    // the bridge reads the intercept flag from the injected constant
    expect(doc).toContain("var INTERCEPT = true");
  });

  it("omits network blocking when interceptNetwork is false", () => {
    const doc = buildSrcDoc(" ", { vars: {}, mount: "", interceptNetwork: false });
    expect(doc).toContain("var INTERCEPT = false");
  });
});

