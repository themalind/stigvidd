import fs from "node:fs";
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

// keep-comment: shared -> features -> app, and no feature imports another (github.com/alan2207/bulletproof-react, docs/project-structure.md)
// keep-comment: a later block replaces an earlier one's no-restricted-imports options, so each block lists every pattern it needs
const features = fs
  .readdirSync(new URL("./src/features", import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const noApp = { group: ["@/app", "@/app/*"], message: "Only app/ composes features; import downwards only." };
const noFeatures = { group: ["@/features", "@/features/*"], message: "Shared code must not depend on a feature." };
const otherFeatures = (feature) => ({
  group: ["@/features/*", `!@/features/${feature}`],
  message: "Features do not import each other: move the code to shared, or compose both in app/routes.",
});
const noClient = {
  group: ["@/api/generated/*", "!@/api/generated/model", "@/api/mutator", "@/api/images"],
  message: "Call the API from features/<x>/api/ or src/api/; components use those hooks.",
};

const restrict = (...patterns) => ({ "no-restricted-imports": ["error", { patterns }] });
const tests = ["src/**/*.test.{ts,tsx}"];

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["src/{api,lib,testing}/**/*.{ts,tsx}"],
    rules: restrict(noApp, noFeatures),
  },
  {
    files: ["src/{components,config,hooks,utils}/**/*.{ts,tsx}"],
    rules: restrict(noApp, noFeatures, noClient),
  },
  ...features.flatMap((feature) => [
    {
      files: [`src/features/${feature}/**/*.{ts,tsx}`],
      ignores: tests,
      rules: restrict(noApp, otherFeatures(feature), noClient),
    },
    {
      files: [
        `src/features/${feature}/api/**/*.{ts,tsx}`,
        ...tests.map((t) => t.replace("src/", `src/features/${feature}/`)),
      ],
      rules: restrict(noApp, otherFeatures(feature)),
    },
  ]),
]);
