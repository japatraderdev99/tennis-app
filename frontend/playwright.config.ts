import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    ...devices["Pixel 7"],
    baseURL: "http://localhost:5183/?velocidade=rapida",
    trace: "retain-on-failure",
  },
  webServer: { command: "npm run dev", url: "http://localhost:5183", reuseExistingServer: true },
});
