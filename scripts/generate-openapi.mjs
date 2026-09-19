#!/usr/bin/env node
/**
 * Writes web/openapi.json from the built StigviddAPI assembly.
 *
 *   node scripts/generate-openapi.mjs             # write it
 *   node scripts/generate-openapi.mjs --check     # write nothing; exit 1 if it would change
 *   node scripts/generate-openapi.mjs --quiet     # only complain
 *   node scripts/generate-openapi.mjs --if-built  # say so and succeed if the API is unbuilt
 *
 * web/openapi.json is GITIGNORED and is orval's input for web/src/api/generated, which IS
 * committed and which the Jenkinsfile web stage diffs. This script is the only thing that
 * produces it. StigviddAPI.csproj runs it after every Debug build, so an ordinary
 * `dotnet build` — CLI, the VS Code "build api" task, or F5 — refreshes the document.
 *
 * WHY THIS IS A NODE SCRIPT AND NOT A COMMAND IN A CSPROJ OR A SHELL LINE. Two reasons,
 * both measured:
 *
 *   1. The host needs configuration to start, and two of the four keys contain a HYPHEN
 *      (Keycloak names its options kebab-case). `KeycloakAdminClient__auth-server-url=x cmd`
 *      is not an assignment to bash — it is a command name, and bash answers "No such file
 *      or directory". PowerShell and cmd each need a third and fourth spelling. Setting
 *      them in process.env has one spelling on all three platforms.
 *   2. This repo is developed on Windows, Gentoo and Debian, and node is one command name
 *      on all of them — the same reasoning as .claude/hooks/. See
 *      docs/notes/agent-harness-hooks.md.
 *
 * WHY NOT NSwag's OWN CLI. `dotnet nswag aspnetcore2openapi` was tried first and cannot
 * work here. It reaches the service provider through HostFactoryResolver, which runs
 * Program.Main straight past builder.Build() into the DbMigrationRunner loop and then
 * fails on a database that generating a document has no reason to touch. The
 * `--export-openapi` switch in Program.cs returns *before* that loop, uses the same
 * IOpenApiDocumentGenerator the /swagger/v1/swagger.json endpoint uses, and needs no
 * database at all.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_DIR = join(REPO_ROOT, "backend", "StigviddAPI");
const ASSEMBLY = join(PROJECT_DIR, "bin", "Debug", "net10.0", "StigviddAPI.dll");
const SPEC = join(REPO_ROOT, "web", "openapi.json");
const CLIENT_DIR = join(REPO_ROOT, "web", "src", "api", "generated");

/**
 * The configuration StigviddAPI needs to get as far as builder.Build(). This list is a
 * DUPLICATE of backend/Tests/IntegrationTests/KeycloakConfigPreload.cs, which pins the same
 * keys for the integration suite for the same reason — the real Program.Main reads real
 * configuration, and these are not in git. Change one, change the other.
 *
 * `.invalid` is reserved and unresolvable (RFC 2606), so nothing here can reach a live
 * Keycloak. The connection string only has to satisfy Program.cs's null check: the export
 * returns before any migration runs and opens no connection.
 */
const HOST_CONFIG = {
  ConnectionStrings__StigVidd: "DataSource=:memory:",
  // The load-bearing one. Without it AddKeycloakAdminHttpClient's ValidateOnStart throws
  // "requires a valid absolute URI for 'AuthServerUrl'" and names neither file nor section.
  "KeycloakAdminClient__auth-server-url": "https://keycloak.invalid/auth",
  "Keycloak__auth-server-url": "https://keycloak.invalid/auth",
  "KeycloakAdminClient__credentials__secret": "generate-openapi-not-a-real-secret",
};

function main() {
  const check = process.argv.includes("--check");
  const quiet = process.argv.includes("--quiet");
  const say = (message) => {
    if (!quiet) console.log(message);
  };

  if (!existsSync(ASSEMBLY)) {
    // --if-built is for callers in ANOTHER area. web's prebuild runs this, and an unbuilt
    // backend must not fail a web build: the committed client is a perfectly good fallback,
    // and nothing else here makes one area's build depend on another's.
    if (process.argv.includes("--if-built")) {
      say("StigviddAPI is not built, so web/openapi.json was left alone.");
      return 0;
    }

    console.error(
      `generate-openapi : error SV0002: ${ASSEMBLY} does not exist.\n` +
        "  Build it first: cd backend && dotnet build StigviddAPI/StigviddAPI.csproj\n" +
        "  (This script deliberately does not build. StigviddAPI.csproj invokes it AFTER a\n" +
        "  build, so building here would recurse.)",
    );
    return 1;
  }

  // Export to a temporary file, then decide. Writing straight to web/openapi.json would
  // leave a half-written document behind if the host threw partway through, and --check
  // could not exist at all.
  const staging = join(tmpdir(), `stigvidd-openapi-${process.pid}.json`);

  try {
    const result = spawnSync(
      "dotnet",
      [ASSEMBLY, "--export-openapi", staging],
      {
        cwd: PROJECT_DIR, // the content root, so appsettings.json is found
        env: { ...process.env, ...HOST_CONFIG },
        encoding: "utf8",
        shell: false, // dotnet is a real executable on all three platforms
      },
    );

    if (result.error || result.status !== 0) {
      console.error(
        "generate-openapi : error SV0003: StigviddAPI failed to export the OpenAPI document.",
      );
      if (result.stdout) console.error(result.stdout.trimEnd());
      if (result.stderr) console.error(result.stderr.trimEnd());
      return 1;
    }

    if (!existsSync(staging) || readFileSync(staging, "utf8").length === 0) {
      console.error(
        "generate-openapi : error SV0004: the export reported success but wrote nothing.",
      );
      return 1;
    }

    const next = readFileSync(staging, "utf8");
    const current = existsSync(SPEC) ? readFileSync(SPEC, "utf8") : null;

    // Three states, not two. "Absent" is a fresh clone — the file is gitignored, so having
    // none is the normal starting point and says NOTHING about whether the committed client
    // is current. Only a document that existed and then moved means the client is stale.
    const created = current === null;
    const changed = !created && current !== next;

    if (check) {
      if (created || changed) {
        console.error(
          "generate-openapi : error SV0005: web/openapi.json is not what the API produces.\n" +
            "  Run: node scripts/generate-openapi.mjs",
        );
        return 1;
      }
      say("web/openapi.json is current.");
      return 0;
    }

    mkdirSync(dirname(SPEC), { recursive: true });
    // Always write, even when the content is identical. StigviddAPI.csproj drives this
    // target with Inputs/Outputs, which compare timestamps: leaving the file untouched
    // would keep it older than the assembly and boot the host again on every no-op build.
    writeFileSync(SPEC, next);

    say(
      created
        ? "web/openapi.json created."
        : changed
          ? "web/openapi.json updated — the API contract moved."
          : "web/openapi.json unchanged.",
    );

    if (changed && existsSync(CLIENT_DIR)) {
      // A warning, never an error. MSBuild picks up this canonical shape from Exec output,
      // so it surfaces in the build log — but generating the client needs npm and web's
      // node_modules, which is the other area's toolchain and not the backend build's job.
      console.log(
        "generate-openapi : warning SV0001: the API contract changed, so the committed " +
          "client under web/src/api/generated is now stale. Run: cd web && npm run generate:api",
      );
    }

    return 0;
  } finally {
    rmSync(staging, { force: true });
  }
}

process.exit(main());
