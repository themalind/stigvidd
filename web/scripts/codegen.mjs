#!/usr/bin/env node
/**
 * Keeps src/api/generated in step with the API, and runs before `npm run dev` and
 * `npm run build` as web/package.json's predev/prebuild.
 *
 * Two steps, in order:
 *
 *   1. refresh ../web/openapi.json from the built backend (scripts/generate-openapi.mjs),
 *   2. run orval over it, which rewrites src/api/generated.
 *
 * src/api/generated IS committed and the Jenkinsfile web stage fails on
 * `git diff --exit-code -- src/api/generated`, so the point of running this on an ordinary
 * build is that the diff shows up in `git status` while you are still working, rather than
 * as a red build later.
 *
 * WHERE THIS DELIBERATELY DOES NOTHING. Three environments run `npm run build` and must not
 * attempt generation. Each is detected, and each says so rather than failing:
 *
 *   * web/Dockerfile        build context is ./web on node:24-alpine, so ../scripts is not
 *                           in the image at all and there is no dotnet. Detected
 *                           STRUCTURALLY, by the generator script's absence - not guessed.
 *   * GitHub CI's web job   a full checkout, but no .NET SDK. Sets
 *                           STIGVIDD_SKIP_API_CODEGEN, because ../scripts DOES exist there
 *                           and the structural check would pass.
 *   * Jenkins' web stage    same flag: Preflight already produced the document and the
 *                           stage regenerates the client explicitly before diffing it, so
 *                           doing it again here is a wasted host boot.
 *
 * A backend that simply has not been built yet is not an error either - see --if-built.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATOR = join(WEB_ROOT, "..", "scripts", "generate-openapi.mjs");
const SPEC = join(WEB_ROOT, "openapi.json");
// The real file, not node_modules/.bin/orval — that is a shim, not an executable, and
// cannot be spawned without a shell on Windows. See docs/notes/agent-harness-hooks.md.
const ORVAL = join(WEB_ROOT, "node_modules", "orval", "dist", "bin", "orval.mjs");

function run(args, label) {
  const result = spawnSync(process.execPath, args, {
    cwd: WEB_ROOT,
    stdio: "inherit",
    shell: false,
  });

  if (result.error || result.status !== 0) {
    console.error(`codegen: ${label} failed.`);
    return false;
  }

  return true;
}

function main() {
  if (!existsSync(GENERATOR)) {
    // The web image. Only web/ was copied, so there is no backend to ask and no dotnet to
    // ask it with. The committed client is what gets bundled, which is correct.
    console.log("codegen: no ../scripts (web-only checkout), using the committed API client.");
    return 0;
  }

  if (process.env.STIGVIDD_SKIP_API_CODEGEN) {
    console.log("codegen: STIGVIDD_SKIP_API_CODEGEN is set, using the committed API client.");
    return 0;
  }

  if (!run([GENERATOR, "--if-built"], "refreshing openapi.json")) return 1;

  if (!existsSync(SPEC)) {
    // Nothing has ever built the backend here. Not fatal: the client in git was generated
    // from this same API by whoever committed it.
    console.log("codegen: no openapi.json yet, using the committed API client.");
    return 0;
  }

  if (!existsSync(ORVAL)) {
    console.error("codegen: orval is not installed. Run npm ci in web/.");
    return 1;
  }

  return run([ORVAL, "--config", "./orval.config.ts"], "generating the API client") ? 0 : 1;
}

process.exit(main());
