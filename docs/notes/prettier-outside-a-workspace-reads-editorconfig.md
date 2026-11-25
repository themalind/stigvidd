# Prettier run with no workspace config reads the root .editorconfig and reindents whole files to 4 spaces

**Symptom.** In `web/`, `npx prettier --write <three files>` produced a 664-line diff: every
line in all three files went from 2-space to 4-space indentation.

**Cause.** Before 2026-09-27, `web/` and `site/` had no prettier dependency and no
`.prettierrc`. `npx` therefore downloaded some prettier version, and with no config file to
find, prettier fell back to the root [.editorconfig](../../.editorconfig). That file says
`[*] indent_size = 4` for the whole repo, meant for the C# backend. Prettier honours
EditorConfig by default, so the TS code was reindented to 4 spaces. `--no-editorconfig`
avoided the reindent, but it applied prettier's default `printWidth: 80`, which still rewrapped
untouched lines.

**What holds now (2026-11-25).** One `.prettierrc` at the repo root (printWidth 120, trailingComma
all) serves every file; app/, web/ and site/ keep only their own prettier in devDependencies and a
`.prettierignore`. `.editorconfig` also says 2 spaces for JS/TS/JSON. `npm run format:check` runs
for all three in CI, and app's also checks `scripts/` and `.claude/hooks/`.
[format-prettier.mjs](../../.claude/hooks/format-prettier.mjs) runs each workspace's own
`node_modules/prettier/bin/prettier.cjs`, from inside that workspace. Do that by hand too. It does
not format `scripts/` or `.claude/hooks/` after an edit: run app's prettier on them
(`cd app && node node_modules/prettier/bin/prettier.cjs --write ../scripts ../.claude/hooks`).

Prettier's output is the project's style. Do not hand-restore the old wrapping afterwards.

Related: [[node-26-shadows-jsdom-localstorage]].
