// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// Pure checks for publish-update.mjs: what an EAS environment and its bundle must contain.

const STAGING_ORG = "3KeRfxpDWf9Hf2CiVsulKJpHWTL";
const PRODUCTION_ORG = "3Igh0Ez9tpaLNBgzzVouYA1NyT5";
const STAGING_API = "https://staging.api.stigvidd.se/api/v1";
const PRODUCTION_API = "https://api.stigvidd.se/api/v1";

function openObserve(org, stream) {
  return `https://observatory.stigvidd.se/api/${org}/${stream}/_json`;
}

// Variables that may span preview and production because both must use the same value.
export const SHARED_ALLOWED = new Set(["EXPO_PUBLIC_MAPTILER_API_KEY", "EXPO_PUBLIC_MAPTILER_STYLE_ID"]);

export const ENVIRONMENTS = {
  production: {
    gitBranch: "main",
    expected: {
      EXPO_PUBLIC_API_URL: PRODUCTION_API,
      EXPO_PUBLIC_OIDC_URL: "https://auth.stigvidd.se",
      EXPO_PUBLIC_OIDC_REALM: "stigvidd",
      EXPO_PUBLIC_CLIENT_ID: "stigvidd-app",
      EXPO_PUBLIC_OO_LOGS_URL: openObserve(PRODUCTION_ORG, "stigvidd_app_logs"),
      EXPO_PUBLIC_OO_EVENTS_URL: openObserve(PRODUCTION_ORG, "stigvidd_app_events"),
    },
    required: ["EXPO_PUBLIC_OO_LOGS_TOKEN", "EXPO_PUBLIC_MAPTILER_API_KEY"],
    bundleMustContain: [PRODUCTION_API, PRODUCTION_ORG],
    bundleMustNotContain: ["staging.api.stigvidd.se", "stigvidd-staging", STAGING_ORG],
  },
  preview: {
    gitBranch: null,
    expected: {
      EXPO_PUBLIC_API_URL: STAGING_API,
      EXPO_PUBLIC_OIDC_URL: "https://auth.stigvidd.se",
      EXPO_PUBLIC_OIDC_REALM: "stigvidd-staging",
      EXPO_PUBLIC_CLIENT_ID: "stigvidd-app",
      EXPO_PUBLIC_OO_LOGS_URL: openObserve(STAGING_ORG, "stigvidd_app_logs"),
      EXPO_PUBLIC_OO_EVENTS_URL: openObserve(STAGING_ORG, "stigvidd_app_events"),
    },
    required: ["EXPO_PUBLIC_OO_LOGS_TOKEN", "EXPO_PUBLIC_MAPTILER_API_KEY"],
    bundleMustContain: [STAGING_API, "stigvidd-staging", STAGING_ORG],
    bundleMustNotContain: ["https://api.stigvidd.se", PRODUCTION_ORG],
  },
};

/** Parses `eas env:list --format long` into { name, value, environments } records. */
export function parseEnvList(text) {
  const records = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const match = /^([A-Za-z][A-Za-z ]*?)\s{2,}(.*)$/.exec(raw.trim());
    if (!match) continue;
    const [, key, value] = match;
    if (key === "Name") {
      current = { name: value.trim(), value: "", environments: [] };
      records.push(current);
    } else if (current && key === "Value") {
      current.value = value.trim();
    } else if (current && key === "Environments") {
      current.environments = value
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    }
  }
  return records;
}

/** Parses the .env file written by `eas env:pull`. */
export function parseDotenv(text) {
  const values = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.endsWith(value[0])) {
      value = value.slice(1, -1);
    }
    values[line.slice(0, eq).trim()] = value;
  }
  return values;
}

/** Returns one message per problem with the variables an environment will bundle. */
export function checkVariables(environment, listed, pulled) {
  const config = ENVIRONMENTS[environment];
  if (!config) return [`Unknown environment "${environment}"`];
  const errors = [];

  for (const [name, expected] of Object.entries(config.expected)) {
    const actual = pulled[name];
    if (actual !== expected) {
      errors.push(`${name} is ${actual === undefined ? "missing" : `"${actual}"`}, expected "${expected}"`);
    }
  }
  for (const name of config.required) {
    if (!pulled[name]) errors.push(`${name} is missing or empty`);
  }
  for (const variable of listed) {
    const shared = variable.environments.includes("preview") && variable.environments.includes("production");
    if (shared && !SHARED_ALLOWED.has(variable.name)) {
      errors.push(`${variable.name} is shared by preview and production; give each environment its own`);
    }
  }
  return errors;
}

/** Returns one message per required string missing from, or forbidden string found in, the bundles. */
export function checkBundle(environment, bundles) {
  const config = ENVIRONMENTS[environment];
  if (!config) return [`Unknown environment "${environment}"`];
  if (bundles.length === 0) return ["No JavaScript bundle found in the export"];
  const errors = [];

  for (const { file, content } of bundles) {
    for (const needle of config.bundleMustContain) {
      if (!content.includes(needle)) errors.push(`${file} does not contain "${needle}"`);
    }
    for (const needle of config.bundleMustNotContain) {
      if (content.includes(needle)) errors.push(`${file} contains "${needle}", which belongs to another environment`);
    }
  }
  return errors;
}
