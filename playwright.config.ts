import { defineConfig } from "@playwright/test";

export default defineConfig({
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "null",
  webServer: {
    command: "yarn wrangler dev --port 8888",
    cwd: "tests/mocks",
    url: "http://localhost:8888",
    reuseExistingServer: !process.env.CI,
  },
});
