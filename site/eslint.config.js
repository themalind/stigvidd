// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import boundaries from "eslint-plugin-boundaries";

// keep-comment: why package.json overrides minimatch: docs/notes/npm-audit-suggests-eslint-9-minimatch-override-instead.md
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
    // Who may import whom in src/; docs/conventions/site.md explains it.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "src/test/**"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { alwaysTryTypes: true } },
      "boundaries/elements": [
        { type: "component", pattern: "src/components", partialMatch: false },
        { type: "content", pattern: "src/content", partialMatch: false },
        { type: "lib", pattern: "src/lib", partialMatch: false },
        { type: "page", pattern: "src", partialMatch: false },
      ],
      "boundaries/legacy-templates": false,
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message: "{{ from.element.type }} may not import {{ to.element.type }} (docs/conventions/site.md)",
          policies: [
            {
              from: { element: { type: "page" } },
              allow: { to: { element: { types: ["component", "content", "lib"] } } },
            },
            { from: { element: { type: "component" } }, allow: { to: { element: { types: ["content", "lib"] } } } },
          ],
        },
      ],
    },
  },
]);
