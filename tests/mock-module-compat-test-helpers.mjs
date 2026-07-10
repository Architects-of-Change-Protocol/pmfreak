// node:test's mock.module() replacement-exports option was renamed across Node
// versions: older runtimes only understand `namedExports`, newer runtimes
// deprecate that in favor of `exports` (and some later builds remove
// `namedExports` entirely — passing it throws rather than warns). Passing both
// keys at once also throws ("cannot be used with"). To keep tests green across
// the Node versions used locally and in CI, detect which key this runtime
// actually honors once, then use it for every mock.module() call.
import { mock } from "node:test";

let cachedKey;

async function detectMockModuleExportsKey() {
  const candidates = [
    { key: "exports", specifier: "node:string_decoder" },
    { key: "namedExports", specifier: "node:querystring" },
  ];
  for (const { key, specifier } of candidates) {
    const ctx = mock.module(specifier, { [key]: { __mockModuleCompatProbe: true } });
    const mod = await import(specifier);
    const worked = mod.__mockModuleCompatProbe === true;
    ctx.restore();
    if (worked) return key;
  }
  throw new Error("mockModuleCompat: neither 'exports' nor 'namedExports' intercepted a probed module on this Node version.");
}

export async function mockModuleExports(specifier, exportsImpl) {
  cachedKey ??= await detectMockModuleExportsKey();
  return mock.module(specifier, { [cachedKey]: exportsImpl });
}
