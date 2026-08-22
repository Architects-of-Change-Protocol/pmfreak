import { defineConfig, devices } from "@playwright/test";

/**
 * P2-14 — authenticated two-tenant Founder browser acceptance.
 *
 * Chromium only, and deliberately so: P2-14 needs real browser evidence for the Founder
 * story (real authentication, hard refresh, responsive layout, accessibility, screenshots)
 * — not cross-browser certification. Adding a browser matrix would multiply runtime
 * without adding evidence this increment is asked to produce.
 *
 * Serial by construction. The Founder story is one causal chain against one deterministic
 * P2-13 scenario; parallel workers would race on the same canonical rows and make a
 * failure impossible to attribute.
 */

const BASE_URL = process.env.OPERATIONAL_FLOW_TEST_BASE_URL?.trim() || "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  // The chain must run in order and only once at a time.
  fullyParallel: false,
  workers: 1,
  // A partially-completed Founder chain is real canonical state; a blind retry would
  // re-enter it midway and report a confusing failure rather than the real one.
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["json", { outputFile: "artifacts/p2-14/report.json" }]],
  outputDir: "artifacts/p2-14/test-results",
  use: {
    baseURL: BASE_URL,
    // Traces and video would embed session cookies and Authorization headers. P2-14
    // artifacts must carry no reusable secret, so both stay off and screenshots are
    // captured explicitly, at named checkpoints, by the spec itself.
    trace: "off",
    video: "off",
    screenshot: "off",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        // WSL/containers have no user namespace for Chromium's sandbox. This affects only
        // the local test browser; it changes nothing about the product or its security.
        launchOptions: { args: ["--no-sandbox", "--disable-dev-shm-usage"] },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 240_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
