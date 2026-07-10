import type { NextConfig } from "next";
import { getRuntimeEnvironment } from "./src/lib/security/environment";
import { getSecurityHeaders } from "./src/lib/security/security-headers";

// Dev/Codespaces-only Server Action origins. Trusting these in production
// would let a request claiming to come from localhost or a stale *.github.dev
// preview pass Next's Server Action origin check — see
// docs/security/production-deployment-boundary.md.
const DEV_ONLY_SERVER_ACTION_ORIGINS = ["localhost:3000", "127.0.0.1:3000", "*.app.github.dev", "*.github.dev"];
const STATIC_SERVER_ACTION_ORIGINS = ["pmfreak-mu.vercel.app"];

const runtimeEnvironment = getRuntimeEnvironment();

const nextConfig: NextConfig = {
  // Next defaults this to false; pinned explicitly so a future change can't
  // silently start publishing source maps in production without review.
  productionBrowserSourceMaps: false,
  experimental: {
    serverActions: {
      allowedOrigins: runtimeEnvironment === "production" ? STATIC_SERVER_ACTION_ORIGINS : [...STATIC_SERVER_ACTION_ORIGINS, ...DEV_ONLY_SERVER_ACTION_ORIGINS],
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: Object.entries(getSecurityHeaders({ environment: runtimeEnvironment })).map(([key, value]) => ({ key, value })),
      },
    ];
  },
};

export default nextConfig;
