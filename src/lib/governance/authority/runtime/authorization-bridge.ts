import { getRuntimeAuthorityPort } from "./authority-provider";

export async function authorizeRuntimeAction(input: Parameters<ReturnType<typeof getRuntimeAuthorityPort>["authorizeAction"]>[0]) {
  return getRuntimeAuthorityPort().authorizeAction(input);
}

export async function enforceRuntimeAuthorization(input: Parameters<ReturnType<typeof getRuntimeAuthorityPort>["enforceAuthorization"]>[0]) {
  return getRuntimeAuthorityPort().enforceAuthorization(input);
}
