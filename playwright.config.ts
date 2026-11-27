import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  testMatch: "**/*.pw.ts",
  workers: 1,
  use: {
    browserName: "chromium",
    viewport: { width: 800, height: 600 },
    trace: "retain-on-failure",
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  projects: [
    { name: "dev", use: { baseURL: "http://127.0.0.1:4173/app/" } },
    { name: "preview", use: { baseURL: "http://127.0.0.1:4174/app/" } },
  ],
  webServer: [
    {
      command: "pnpm exec vite --config tests/browser/vite.config.ts --port 4173",
      url: "http://127.0.0.1:4173/app/",
    },
    {
      command:
        "pnpm exec vite build --config tests/browser/vite.config.ts && pnpm exec vite preview --config tests/browser/vite.config.ts --port 4174",
      url: "http://127.0.0.1:4174/app/",
    },
  ],
});
