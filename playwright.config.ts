import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: {
    locale: "ja-JP",
    extraHTTPHeaders: {
      "Accept-Language": "ja,ja-JP;q=0.9",
    },
  },
});
