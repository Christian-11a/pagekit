import { defineConfig, devices } from "@playwright/test";
const browser = process.env.PAGEKIT_TEST_BROWSER || "edge";
const settings =
  browser === "firefox"
    ? devices["Desktop Firefox"]
    : {
        ...devices["Desktop Chrome"],
        channel: browser === "chrome" ? "chrome" : "msedge",
      };
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5180",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: browser, use: settings }],
  webServer: {
    command: process.env.PAGEKIT_PRODUCTION
      ? "npm run preview -- --port 5180 --strictPort"
      : "npm run dev -- --port 5180 --strictPort",
    url: "http://127.0.0.1:5180",
    reuseExistingServer: !process.env.CI,
  },
});
