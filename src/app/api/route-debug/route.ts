import { NextResponse } from "next/server";

// Safe, public diagnostic endpoint for confirming the routing decisions the
// app is actually configured to make — i.e. where an authenticated user
// lands by default and whether legacy shells are still wired as redirect
// targets. Returns no user data, no secrets.
export async function GET() {
  return NextResponse.json({
    app: "pmfreak",
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    defaultAuthenticatedRoute: "/command-center",
    workspaceRedirectTarget: "/command-center",
    setupCompletedRedirectTarget: "/command-center",
    commandCenterMarker: "command-center-light-v2",
  });
}
