#!/usr/bin/env node
// SessionStart: the facts about THIS tree that a session otherwise assumes.
//
// Each one is something that is invisible without asking, and wrong to guess:
//
//   * A DIRTY TREE AT SESSION START.  Work left by a previous session is
//     indistinguishable from your own the moment you run `git status` an hour later.
//     This repo is routinely dirty on arrival.
//   * WHICH CHECKOUT THIS IS.  Work here happens in linked worktrees, and two things
//     differ in one: `.git` is a FILE (which is what broke OpenApiContractTests — see
//     docs/notes/git-worktree-repo-root.md), and `.codegraph/` is per-checkout, so a
//     fresh worktree has NO index and `codegraph` silently has nothing to say.
//   * THE CONTRACT CHAIN.  Controller -> web/openapi.json -> web/src/api/generated is a
//     one-way pipeline with a test in the middle that REWRITES the snapshot and fails.
//     Whether you are mid-chain is decidable from the working tree, and it is the single
//     most common way a green-looking backend change breaks the web build.
//   * THE GREEN COMMANDS, verbatim, including the environment variable without which
//     every integration test fails for a reason unrelated to your change.
//
// Reads only `git status`/`rev-parse` and a few directory listings — no build, no network.
// Fails silent: no orientation beats a wrong one.
//
//   node .claude/hooks/session-start.mjs --print       # what it would inject
//   node .claude/hooks/session-start.mjs --self-test
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { readEvent, repoRoot, git, run, inject, checker, lines } from "./lib.mjs";

const CONN = "ConnectionStrings__StigVidd";

/** Parse `git status --porcelain -z -uall` into [{x, y, p}], rename sources skipped. */
export function parsePorcelainZ(out) {
  const fields = String(out ?? "").split("\0");
  const entries = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.length < 4) continue;
    const [x, y] = [f[0], f[1]];
    entries.push({ x, y, p: f.slice(3) });
    if (x === "R" || x === "C") i++; // the source path follows, as its own field
  }
  return entries;
}

/**
 * What the working tree says about the contract chain and the EF model.
 * Pure, so the self-test can drive it without a repo in a given state.
 */
export function classify(entries) {
  const touched = (re) => entries.some((e) => re.test(e.p));
  const api = touched(/^backend\/(?:StigviddAPI\/Controllers|WebDataContracts)\//i);
  const snapshot = touched(/^web\/openapi\.json$/i);
  const client = touched(/^web\/src\/api\/generated\//i);
  const model = touched(/Migrations\/StigViddDbContextModelSnapshot\.cs$/i);
  const migration = entries.some(
    (e) => /^backend\/Infrastructure\/Migrations\/\d+_.*\.cs$/i.test(e.p) && (e.x === "?" || e.x === "A"),
  );
  const notes = [];
  if (api && !snapshot)
    notes.push(
      "The API surface is modified but web/openapi.json is not: the next backend test " +
        "run will rewrite that snapshot and FAIL ONCE telling you so. That failure is " +
        "expected — review the rewrite, then `cd web && npm run generate:api`.",
    );
  if (snapshot && !client)
    notes.push(
      "web/openapi.json is modified but web/src/api/generated is not — the typed client " +
        "is stale. `cd web && npm run generate:api` and commit both; the Jenkinsfile web " +
        "stage regenerates and fails on `git diff --exit-code -- src/api/generated`.",
    );
  if (model && !migration)
    notes.push(
      "StigViddDbContextModelSnapshot.cs is modified with no new migration file beside " +
        "it. EF writes that snapshot only as part of scaffolding a migration, so either " +
        "a migration is missing or the snapshot was edited by hand — the second " +
        "silently desynchronises the model from the schema.",
    );
  return notes;
}

export function compose(root) {
  const out = [];

  // --- the tree ------------------------------------------------------------------
  const branch = (git(root, "rev-parse", "--abbrev-ref", "HEAD") ?? "").trim();
  const gitDir = (git(root, "rev-parse", "--git-dir") ?? "").trim();
  const commonDir = (git(root, "rev-parse", "--git-common-dir") ?? "").trim();
  const linked = gitDir !== "" && commonDir !== "" && path.resolve(root, gitDir) !== path.resolve(root, commonDir);
  const entries = parsePorcelainZ(git(root, "status", "--porcelain", "-z", "-uall"));

  let tree = `Tree: branch ${branch || "?"} at ${path.basename(root)}`;
  if (linked) tree += " (a LINKED worktree — `.git` here is a file, not a directory)";
  tree +=
    entries.length > 0
      ? `, ${entries.length} uncommitted file(s) ALREADY dirty at session start — that ` +
        "work is not yours until you check (`git diff`, `git log -1`)."
      : ", clean.";
  out.push(tree);

  // --- what this checkout cannot do ----------------------------------------------
  if (!existsSync(path.join(root, ".codegraph")))
    out.push(
      "CodeGraph: this checkout has NO .codegraph/ index (it is per-checkout and is not " +
        "committed), so `codegraph explore` and the codegraph MCP tool have nothing to " +
        "read here. Use grep/Read, or index this tree first.",
    );

  // --- the contract chain and the EF model ---------------------------------------
  const notes = classify(entries);
  if (notes.length) out.push("Mid-flight:\n" + notes.map((n) => "  - " + n).join("\n"));

  // --- migrations -----------------------------------------------------------------
  try {
    const dir = path.join(root, "backend", "Infrastructure", "Migrations");
    const names = readdirSync(dir)
      .filter((f) => /^\d+_.*\.cs$/.test(f) && !/\.Designer\.cs$/.test(f))
      .sort();
    if (names.length)
      out.push(
        `Migrations: ${names.length}, newest ${names[names.length - 1].replace(/\.cs$/, "")}. ` +
          "Scaffold with `cd backend && dotnet ef migrations add <Name> --project " +
          "Infrastructure` (the design-time factory is in Infrastructure, so no " +
          "--startup-project); DbMigrationRunner applies them on API startup.",
      );
  } catch {
    /* not a checkout of this repo */
  }

  // --- the toolchain --------------------------------------------------------------
  const major = Number(process.versions.node.split(".")[0]);
  if (Number.isFinite(major) && major < 22)
    out.push(
      `Node: this box runs v${process.versions.node}. web/ dependencies declare ` +
        ">=22 (orval >=22.18) and the shipped bundle is built on node:24 — npm only " +
        "prints EBADENGINE and carries on, so nothing else will tell you.",
    );

  // --- the green commands ---------------------------------------------------------
  out.push(
    "Green means, per area (nothing checks another area's):\n" +
      `  backend  cd backend && dotnet build && ${CONN}="DataSource=:memory:" dotnet test --no-build\n` +
      "  web      cd web && npm run lint && npm run generate:api && git diff --exit-code -- src/api/generated && npm run build\n" +
      "  app      cd app && npm run format:check && npm run lint && npm test -- --watchAll=false\n" +
      "  harness  node scripts/check-hooks.mjs\n" +
      `  ${CONN} is required or every integration test fails at host startup; on ` +
      `PowerShell it is \`$env:${CONN}="DataSource=:memory:"; dotnet test --no-build\`.\n` +
      "  There are NO web tests — `npm run build` (tsc -b && vite build) IS the web type " +
      "check. Nothing in GitHub CI builds an image or runs docker compose.",
  );

  // --- memory ----------------------------------------------------------------------
  try {
    const n = readdirSync(path.join(root, "docs", "notes")).filter(
      (f) => f.endsWith(".md") && f !== "INDEX.md",
    ).length;
    if (n)
      out.push(
        `Memory: ${n} note(s) in docs/notes/ — this repo's durable, project-specific ` +
          "knowledge. Search it before re-deriving anything (`node " +
          '.claude/hooks/plan-eval.mjs --match "<what you are about to do>"`), and add ' +
          "to it with the write-a-note skill.",
      );
  } catch {
    /* no notes yet */
  }

  return out.join("\n\n");
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) return selfTest();
  const ev = argv.includes("--print") ? {} : readEvent();
  const root = repoRoot(ev);
  if (!root) return 0;
  let text;
  try {
    text = compose(root);
  } catch {
    return 0; // a broken orientation must not cost a session
  }
  if (!text) return 0;
  if (argv.includes("--print")) {
    process.stdout.write(text + "\n");
    return 0;
  }
  return inject(text);
}

function selfTest() {
  const { ok, done } = checker("session-start");
  let n = 0;

  // -- porcelain parsing, including the rename form whose source path follows ------
  const p1 = parsePorcelainZ(" M a.cs\0?? b.ts\0R  new.cs\0old.cs\0");
  ok(p1.length === 3, `porcelain: ${p1.length} entries, expected 3 (rename source counted?)`);
  ok(p1.map((e) => e.p).join(",") === "a.cs,b.ts,new.cs", `porcelain paths: ${p1.map((e) => e.p)}`);
  n += 2;

  // -- the contract chain, in each state it can be in -----------------------------
  const st = (...ps) => ps.map((p) => ({ x: " ", y: "M", p }));
  ok(classify(st("backend/StigviddAPI/Controllers/FacilitiesController.cs")).length === 1,
     "a controller change with no snapshot rewrite went unmentioned");
  ok(classify(st("backend/WebDataContracts/FacilityResponse.cs")).length === 1,
     "a WebDataContracts change went unmentioned");
  ok(classify(st("backend/StigviddAPI/Controllers/X.cs", "web/openapi.json")).length === 1,
     "snapshot present but stale client should still be flagged");
  ok(classify(st("backend/StigviddAPI/Controllers/X.cs", "web/openapi.json",
                 "web/src/api/generated/x.ts")).length === 0,
     "a fully regenerated chain must be silent");
  ok(classify(st("backend/Core/Services/FacilityService.cs")).length === 0,
     "a service-only change must not claim the contract drifted");
  n += 5;

  // -- the EF model snapshot, with and without a migration beside it --------------
  ok(classify([{ x: " ", y: "M", p: "backend/Infrastructure/Migrations/StigViddDbContextModelSnapshot.cs" }])
       .some((s) => /snapshot/i.test(s)),
     "a lone model-snapshot change went unmentioned");
  ok(classify([
       { x: " ", y: "M", p: "backend/Infrastructure/Migrations/StigViddDbContextModelSnapshot.cs" },
       { x: "?", y: "?", p: "backend/Infrastructure/Migrations/20260822182423_Foo.cs" },
     ]).length === 0,
     "a scaffolded migration + its snapshot must be silent — that is the normal shape");
  n += 2;

  // -- the composed text, against this actual checkout ---------------------------
  const root = repoRoot({});
  if (root) {
    const text = compose(root);
    for (const [want, why] of [
      ["Tree:", "the tree/dirty fact"],
      [CONN, "the connection-string variable"],
      ["Green means", "the green commands"],
      ["npm run generate:api", "the regeneration command"],
    ]) {
      ok(text.includes(want), `orientation is missing ${why}`);
      n++;
    }
    // A cwd outside the checkout must still resolve, via the cwd fallback: SessionStart
    // fires before anything has established where we are.
    ok(repoRoot({ cwd: path.sep }) !== null, "repoRoot did not fall back when cwd was outside a repo");
    n++;
  }
  return done(n);
}

process.exit(main());
