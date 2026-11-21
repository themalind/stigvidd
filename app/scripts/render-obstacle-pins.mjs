#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// Renders the obstacle map pins (one per issue type, @1x/@2x/@3x) with headless Chrome.
// Usage: node scripts/render-obstacle-pins.mjs   (set CHROME to the browser binary if it is not found)

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const OUT_DIR = fileURLToPath(new URL("../src/assets/map/obstacle/", import.meta.url));

// keep-comment: the petroleum theme's tertiary, fixed like every map marker since the basemap is always light
const FILL = "#C45C26";
const STROKE = "#FFFFFF";
const BADGE_FILL = "#161C1E";
// keep-comment: 2 px wider and taller than the 32x42 pin, so the badge fits and the tip still meets the bottom edge
const WIDTH = 36;
const HEIGHT = 44;
const SCALES = [1, 2, 3];

const PIN = `<path d="M16 40.5C16 40.5 3 26 3 15.5a13 13 0 0 1 26 0C29 26 16 40.5 16 40.5Z" fill="${FILL}" stroke="${STROKE}" stroke-width="2.5" stroke-linejoin="round"/>`;

// keep-comment: the "!" on every pin says something is wrong; the glyph says what
const BADGE = `<circle cx="26.5" cy="6" r="5.8" fill="${BADGE_FILL}" stroke="${STROKE}" stroke-width="1.6"/>
  <rect x="25.75" y="2.8" width="1.5" height="4.2" rx="0.75" fill="${STROKE}"/>
  <circle cx="26.5" cy="8.7" r="0.95" fill="${STROKE}"/>`;

// keep-comment: keys are the backend's TrailIssueType names; facilities are drawn broken, not merely present
const GLYPHS = {
  FallenTree: `<g transform="translate(17.5 16) scale(0.85) rotate(90) translate(-16 -15.5)">
      <path d="M16 6 21 12H18.5L22.5 17H19.5L23 21.5H9L12.5 17H9.5L13.5 12H11Z"/>
      <rect x="14.8" y="21.5" width="2.4" height="3.5"/>
    </g>
    <path d="M5.5 22.5V16.5L7.2 15.2 8.8 16.5V22.5Z"/>
    <rect x="4.5" y="22.6" width="22" height="1.8" rx="0.9"/>`,
  Mud: `<path d="M12 8C12 8 7.5 13.5 7.5 16.5a4.5 4.5 0 0 0 9 0C16.5 13.5 12 8 12 8Z"/>
    <path d="M20.5 13C20.5 13 17.5 16.8 17.5 18.8a3 3 0 0 0 6 0C23.5 16.8 20.5 13 20.5 13Z"/>
    <rect x="7" y="22.5" width="17" height="2" rx="1"/>`,
  Flooding: `<g fill="none" stroke="${STROKE}" stroke-width="2.2" stroke-linecap="round">
      <path d="M7 11.5q2.25-2.5 4.5 0t4.5 0 4.5 0 4.5 0"/>
      <path d="M7 16.5q2.25-2.5 4.5 0t4.5 0 4.5 0 4.5 0"/>
      <path d="M7 21.5q2.25-2.5 4.5 0t4.5 0 4.5 0 4.5 0"/>
    </g>`,
  Shelter: `<g fill="none" stroke="${STROKE}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
      <path d="M6.5 22.5 13 8.5 18.5 10.5"/>
      <path d="M20.5 13 25.5 20.5"/>
      <path d="M13 8.5V22.5"/>
      <path d="M25.5 20.5V22.5"/>
      <path d="M5.5 22.5H26.5"/>
    </g>`,
  FirePit: `<path d="M16 6.5C17 10.5 21.5 12 21.5 17a5.5 5.5 0 0 1-11 0C10.5 14 12.5 12.5 13 10.5 14 12 14.5 13 15 13.5 15.5 11 15.5 9 16 6.5Z"/>
    <rect x="8.5" y="22" width="15" height="2.2" rx="1.1" transform="rotate(10 16 23)"/>
    <rect x="8.5" y="22" width="15" height="2.2" rx="1.1" transform="rotate(-10 16 23)"/>
    <path d="M8.5 7.5 23.5 24.5" stroke="${STROKE}" stroke-width="4.6" stroke-linecap="round"/>
    <path d="M8.5 7.5 23.5 24.5" stroke="${FILL}" stroke-width="2.2" stroke-linecap="round"/>`,
  Walkway: `<rect x="7" y="9" width="18" height="3.4" rx="0.8"/>
    <path d="M7 14.3H14.2L15.4 15.6 14 17.7H7Z" transform="rotate(-9 7 16)"/>
    <path d="M25 14.3H18.2L17 16.4 18.4 17.7H25Z" transform="rotate(11 25 16)"/>
    <rect x="7" y="19.6" width="18" height="3.4" rx="0.8"/>`,
  Signage: `<rect x="14.8" y="7" width="2.4" height="18" rx="1"/>
    <path d="M9 9H21.5L24.5 12 21.5 15H9Z"/>
    <path d="M17.5 16.5H8L5.5 19.5 8 22.5H17.5Z" opacity="0.85" transform="rotate(38 17.5 16.5)"/>`,
  Other: `<circle cx="10" cy="15.5" r="2.3"/>
    <circle cx="16" cy="15.5" r="2.3"/>
    <circle cx="22" cy="15.5" r="2.3"/>`,
};

function svgFor(glyph) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><g transform="translate(2 2)">${PIN}<g fill="${STROKE}">${glyph}</g>${BADGE}</g></svg>`;
}

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  const found = candidates.find((path) => existsSync(path));
  if (!found) {
    console.error("✖ No Chrome or Chromium found. Set CHROME to the browser binary.");
    process.exit(1);
  }
  return found;
}

function screenshot(chrome, htmlFile, pngFile, scale) {
  // keep-comment: removed first, so a Chrome that exits 0 without writing cannot pass on the committed file
  rmSync(pngFile, { force: true });
  const result = spawnSync(
    chrome,
    [
      "--headless",
      "--disable-gpu",
      "--hide-scrollbars",
      "--default-background-color=00000000",
      `--force-device-scale-factor=${scale}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      `--screenshot=${pngFile}`,
      pathToFileURL(htmlFile).href,
    ],
    { stdio: "pipe" },
  );
  if (result.status !== 0 || !existsSync(pngFile)) {
    throw new Error(`Chrome could not render ${pngFile}\n${result.stderr?.toString() ?? ""}`);
  }
}

const chrome = findChrome();
const workDir = mkdtempSync(join(tmpdir(), "obstacle-pins-"));
mkdirSync(OUT_DIR, { recursive: true });

try {
  for (const [type, glyph] of Object.entries(GLYPHS)) {
    const htmlFile = join(workDir, `${type}.html`);
    writeFileSync(
      htmlFile,
      `<!doctype html><html><body style="margin:0;background:transparent">${svgFor(glyph)}</body></html>`,
    );
    for (const scale of SCALES) {
      const suffix = scale === 1 ? "" : `@${scale}x`;
      screenshot(chrome, htmlFile, join(OUT_DIR, `obstacle-pin-${type}${suffix}.png`), scale);
    }
    console.log(`✔ ${type}`);
  }
} catch (error) {
  console.error(`✖ ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
