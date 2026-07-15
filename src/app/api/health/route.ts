import { NextResponse } from "next/server";
import { ensurePmfreakAocAdaptersRegistered, getEnterpriseRuntimeComposeOptions } from "@/lib/aoc/bootstrap";
import { logger, safeErrorMessage } from "@/lib/observability/logger";

export async function GET() {
  const startedAt = Date.now();
  try {
    ensurePmfreakAocAdaptersRegistered();
    const options = getEnterpriseRuntimeComposeOptions();
    const adapters = Object.keys(options.adapters);
    return NextResponse.json({
      status: "ok",
      app: "pmfreak",
      version: process.env.npm_package_version ?? "0.1.0",
      timestamp: new Date().toISOString(),
      runtime: { adapters, adapterCount: adapters.length },
      diagnostics: { startupMs: Date.now() - startedAt },
    });
  } catch (error) {
    logger.error("route_internal_error", { route: "/api/health", error_detail: safeErrorMessage(error) });
    return NextResponse.json({
      status: "error",
      message: "startup_failed",
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
