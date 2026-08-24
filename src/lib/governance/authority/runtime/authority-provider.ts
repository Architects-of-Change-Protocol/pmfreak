import { ExternalRuntimeAuthorityAdapter } from "./external-authority-adapter";
import { InProcessRuntimeAuthorityAdapter } from "./in-process-authority-adapter";
import type { InProcessAuthorityDependencies, RuntimeAuthorityPort, RuntimeAuthorityProviderKind } from "./authority-port";

let testOverride: RuntimeAuthorityPort | null = null;
let inProcessAuthorityDependencies: InProcessAuthorityDependencies | null = null;

export function resolveRuntimeAuthorityProviderKind(): RuntimeAuthorityProviderKind {
  const raw = process.env.AOC_RUNTIME_AUTHORITY_PROVIDER;
  if (!raw) return "in_process";
  if (raw === "in_process" || raw === "external_sdk" || raw === "remote_service" || raw === "federated") return raw;
  return "federated";
}

export function registerInProcessAuthorityDependencies(dependencies: InProcessAuthorityDependencies) {
  inProcessAuthorityDependencies = dependencies;
}

export function getRuntimeAuthorityPort(): RuntimeAuthorityPort {
  if (testOverride) return testOverride;
  const kind = resolveRuntimeAuthorityProviderKind();
  if (kind === "in_process") {
    if (!inProcessAuthorityDependencies) throw new Error("In-process runtime authority dependencies are not registered.");
    return new InProcessRuntimeAuthorityAdapter(inProcessAuthorityDependencies);
  }
  return new ExternalRuntimeAuthorityAdapter(kind);
}

export function setRuntimeAuthorityPortForTests(port: RuntimeAuthorityPort) { testOverride = port; }
export function resetRuntimeAuthorityPortForTests() { testOverride = null; }
