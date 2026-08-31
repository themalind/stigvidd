import path from "path";
import { defineConfig } from "vitest/config";

// Deliberately not vite.config.ts: that file is what `vite build` loads, and keeping
// the runner out of it means a broken test config can never break the bundle. The
// `@` alias is the only thing worth sharing, and it is one line.
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
    exclude: ["src/api/generated/**", "node_modules/**", "dist/**"],
    // import.meta.env for tests comes from here, never from the developer's own
    // .env. keycloak-auth.ts reads VITE_OIDC_* at module load, so a real URL
    // leaking in would point the token tests at a live Keycloak.
    env: {
      VITE_API_URL: "https://api.test",
      VITE_OIDC_URL: "https://oidc.test",
      VITE_OIDC_REALM: "test-realm",
      VITE_CLIENT_ID: "test-client",
      // telemetry.ts reads these at module load too. Left EMPTY on purpose: the default
      // for the suite is telemetry OFF, so no test can post to a real observatory even if
      // the developer's own .env has working credentials. The tests that need it on set
      // them per-file with vi.stubEnv and re-import the module.
      VITE_OO_LOGS_URL: "",
      VITE_OO_LOGS_TOKEN: "",
    },
    restoreMocks: true,
    // Sets global test timeout to 30 seconds
    testTimeout: 30000,
    // Optional: Increase hook timeout (beforeEach, afterAll, etc.)
    hookTimeout: 25000, 
  },
});
