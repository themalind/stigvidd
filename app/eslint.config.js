// https://docs.expo.dev/guides/using-eslint/
const path = require("node:path");
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const boundaries = require("eslint-plugin-boundaries");
const tsRecommended = require("@typescript-eslint/eslint-plugin").configs["flat/recommended"];

// The folders of src/ and who may import whom; docs/conventions/app.md explains each one.
const layers = [
  ["route", "app"],
  ["component", "components"],
  ["hook", "hooks"],
  ["atom", "atoms"],
  ["service", "services"],
  ["api", "api"],
  ["util", "utils"],
  ["data", "data"],
  ["constant", "constants"],
  ["i18n", "i18n"],
  ["asset", "assets"],
  ["types", "@types"],
  ["harness", "test"],
];

const to = (...types) => ({ to: { element: { types } } });

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*", "coverage/*"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      ...Object.assign({}, ...tsRecommended.map((config) => config.rules)),
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: path.dirname(require.resolve("./tsconfig.json")) },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/switch-exhaustiveness-check": ["error", { considerDefaultExhaustiveForUnions: true }],
      "@typescript-eslint/no-deprecated": "error",
      "@typescript-eslint/prefer-nullish-coalescing": [
        "error",
        { ignorePrimitives: { string: true, boolean: true }, ignoreBooleanCoercion: true },
      ],
      "@typescript-eslint/return-await": ["error", "in-try-catch"],
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",
      "@typescript-eslint/restrict-template-expressions": "error",
      "@typescript-eslint/only-throw-error": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": "error",
    },
  },
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    ignores: ["**/__tests__/**", "**/__mocks__/**", "**/*.test.{ts,tsx}", "src/test/**"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { alwaysTryTypes: true } },
      "boundaries/elements": layers.map(([type, folder]) => ({
        type,
        pattern: `src/${folder}`,
        partialMatch: false,
      })),
      "boundaries/legacy-templates": false,
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message: "{{ from.element.type }} may not import {{ to.element.type }} (docs/conventions/app.md)",
          policies: [
            {
              from: { element: { type: "route" } },
              allow: to("component", "hook", "atom", "service", "api", "util", "data", "constant", "i18n", "asset"),
            },
            {
              from: { element: { type: "component" } },
              allow: to("hook", "atom", "service", "api", "util", "data", "constant", "i18n", "asset"),
            },
            {
              from: { element: { type: "hook" } },
              allow: [
                to("atom", "service", "api", "util", "data", "constant", "i18n"),
                { to: { element: { type: "component", fileInternalPath: "auth/auth-provider.tsx" } } },
              ],
            },
            {
              from: { element: { type: "atom" } },
              allow: [to("service", "api", "data", "constant"), { ...to("component"), dependency: { kind: "type" } }],
            },
            {
              from: { element: { type: "service" } },
              allow: [
                to("atom", "api", "data", "constant", "i18n"),
                { ...to("component"), dependency: { kind: "type" } },
              ],
            },
            {
              from: { element: { type: "api" } },
              allow: to("service", "data", "constant", "i18n"),
            },
            {
              from: { element: { type: "util" } },
              allow: [
                to("service", "data", "constant", "i18n"),
                { to: { element: { type: "api", fileInternalPath: "core/**" } } },
              ],
            },
            {
              from: { element: { type: "types" } },
              allow: to("i18n"),
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Call the API through src/api/core/request.ts (send/sendForJson)." },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/back-button"],
              message: "Use ScreenHeader (components/layout/screen-header), so every screen's header looks the same.",
            },
          ],
        },
      ],
    },
  },
  {
    // keep-comment: the logger is the one place that writes to the console
    files: ["src/services/logger.ts"],
    rules: { "no-console": "off" },
  },
  {
    files: ["src/components/layout/screen-header.tsx"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // keep-comment: these talk to Keycloak and the telemetry endpoint, not to the Stigvidd API
    files: ["src/api/core/**", "src/services/keycloak-auth.ts", "src/services/telemetry.ts"],
    rules: { "no-restricted-globals": "off" },
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
      "no-console": "off",
      "no-restricted-syntax": [
        "error",
        {
          // keep-comment: flushUntil stops waiting without failing, so a test that ends on it asserts nothing
          selector:
            "CallExpression:matches([callee.name=/^(it|test)$/], [callee.object.name=/^(it|test)$/], [callee.callee.object.name=/^(it|test)$/]) > :function > BlockStatement > ExpressionStatement:last-child > AwaitExpression > CallExpression[callee.name=/^flushUntil(Gone)?$/]",
          message:
            "flushUntil never fails, so a test that ends on it asserts nothing. Follow it with an expect() on the same condition.",
        },
      ],
    },
  },
]);
