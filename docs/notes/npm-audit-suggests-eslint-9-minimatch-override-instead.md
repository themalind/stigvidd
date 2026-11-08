# npm audit tells you to go back to ESLint 9: the `minimatch` override is why it does not

**Symptom (2026-11-08).** Upgrading `web/` and `site/` to ESLint 10 raised `npm audit` from 7 to
10 moderate. Every one traces to `minimatch`: ESLint 10 and `typescript-eslint` use 10.2.6, and
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) covers `>=7.0.0 <11.0.1`.
The advice `npm audit` prints is `eslint@9.39.5`, listed as a fix, which is a downgrade.

**What we do instead.** Both `package.json` files have
`"overrides": { "minimatch": "^11.0.5" }`, because that file cannot hold a comment. `npm audit`
then reports 0.

**Measured with the override.** `eslint .` still passes, and it still enforces the globs that
matter: an import of `@/features/users/...` from `src/features/media/` fails with
`no-restricted-imports`, and the same import from `src/features/users/` passes. A broken glob
library would lose those rules quietly, so a green lint alone would not show it.

**When to remove it.** Run `npm ls minimatch` after an ESLint or `typescript-eslint` upgrade. Once
neither asks for a version below 11.0.1, delete the override from both files and check that
`npm audit` still reports 0.

The advisory is a denial of service through glob patterns, and here only lint config supplies
those. It never reached a shipped bundle. The override exists to keep the audit at 0 so that a real
finding stands out.
