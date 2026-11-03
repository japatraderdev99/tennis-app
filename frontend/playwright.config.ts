import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    ...devices["Pixel 7"],
    baseURL: "http://127.0.0.1:5184/?velocidade=rapida",
    trace: "retain-on-failure",
  },
  webServer: { command: "npm run dev", url: "http://127.0.0.1:5184", reuseExistingServer: !process.env.CI },
});
