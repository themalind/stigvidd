// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import path from "path";
import { defineConfig } from "vitest/config";

// Deliberately not vite.config.ts, same as web/: that file is what `vite build` loads,
// and keeping the runner out of it means a broken test config can never break the bundle.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "dist/**"],
    restoreMocks: true,
  },
});
