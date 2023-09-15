import { defineConfig } from "@playwright/test";

export default defineConfig({
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // Upstream mock won't be able to handle parallel requests
  reporter: process.env.CI ? "github" : "null",
  webServer: {
    command: "yarn wrangler dev --port 8888",
    cwd: "tests/mocks",
    url: "http://localhost:8888",
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:8888",
  },
});
