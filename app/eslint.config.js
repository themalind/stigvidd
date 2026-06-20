// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Test files: jest.mock() calls are intentionally placed above imports (babel-jest
    // hoists them), and accessing the i18next default instance's methods trips
    // no-named-as-default-member. Both are expected in this codebase's tests.
    files: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**"],
    rules: {
      "import/first": "off",
      "import/no-named-as-default-member": "off",
    },
  },
]);
