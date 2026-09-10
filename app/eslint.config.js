// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Manual mocks are modules Jest loads, not test files, so the patterns below do not
    // reach them — but they call jest.fn() all the same.
    files: ["**/__mocks__/**"],
    languageOptions: { globals: { jest: "readonly" } },
  },
  {
    // The setup files run inside the test environment and use its globals.
    files: ["jest.setup.js", "jest.after-env.js"],
    languageOptions: {
      globals: { jest: "readonly", beforeEach: "readonly", afterEach: "readonly", afterAll: "readonly" },
    },
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
