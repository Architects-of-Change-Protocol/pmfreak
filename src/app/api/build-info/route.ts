import { NextResponse } from "next/server";

// Safe, public diagnostic endpoint for confirming which commit/branch is
// actually deployed to a given environment, since UI screenshots alone
// can't distinguish "stale deployment" from "code still wrong".
export async function GET() {
  return NextResponse.json({
    app: "pmfreak",
    commandCenterBuildMarker: "command-center-light-v2",
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    buildTimestamp: process.env.NEXT_PUBLIC_BUILD_TIMESTAMP ?? null,
  });
}
