// Opt-in local-environment override: identical to playwright.config.ts but pins a
// pre-installed Chromium executable, for sandboxes that cannot download Playwright's
// own browser build (P0-PKG-04 ran the P2-14 journey with it). Never used unless
// selected explicitly: npx playwright test --config playwright.local.config.ts
import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          executablePath: "/opt/pw-browsers/chromium",
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        },
      },
    },
  ],
});
