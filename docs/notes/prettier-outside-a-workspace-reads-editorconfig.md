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

**What holds now.** app/, web/ and site/ each have prettier 3.6.2 in devDependencies, their own
`.prettierrc` (the same settings: printWidth 120, trailingComma all) and a `.prettierignore`.
`npm run format:check` runs for all three in CI.
[format-prettier.mjs](../../.claude/hooks/format-prettier.mjs) runs each workspace's own
`node_modules/prettier/bin/prettier.cjs`, from inside that workspace. Do that by hand too. A
file with no `.prettierrc` above it, such as root files or `.claude/`, still falls through to
`.editorconfig`, so `npx -y prettier` there reindents to 4 spaces.

Prettier's output is the project's style. Do not hand-restore the old wrapping afterwards.

Related: [[node-26-shadows-jsdom-localstorage]].
