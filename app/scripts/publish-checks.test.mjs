// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENVIRONMENTS, checkBundle, checkVariables, parseDotenv, parseEnvList } from "./publish-checks.mjs";

const ENV_LIST = `
Environment: production
Name          EXPO_PUBLIC_API_URL
Value         https://api.stigvidd.se/api/v1
Environments  production
Created at    Nov 06 07:30:00
Updated at    Nov 06 07:30:00

Name          EXPO_PUBLIC_MAPTILER_API_KEY
Value         abc
Environments  development, preview, production
`;

function goodPulled(environment) {
  return { ...ENVIRONMENTS[environment].expected, EXPO_PUBLIC_OO_LOGS_TOKEN: "t", EXPO_PUBLIC_MAPTILER_API_KEY: "k" };
}

function goodBundle(environment) {
  return [{ file: "index.hbc", content: ENVIRONMENTS[environment].bundleMustContain.join(" ") }];
}

describe("parseEnvList", () => {
  it("reads name, value and environments per record", () => {
    assert.deepEqual(parseEnvList(ENV_LIST), [
      { name: "EXPO_PUBLIC_API_URL", value: "https://api.stigvidd.se/api/v1", environments: ["production"] },
      { name: "EXPO_PUBLIC_MAPTILER_API_KEY", value: "abc", environments: ["development", "preview", "production"] },
    ]);
  });
});

describe("parseDotenv", () => {
  it("reads quoted and unquoted values and skips comments", () => {
    assert.deepEqual(parseDotenv("# pulled\nA=1\nB=\"two = 2\"\r\n\nC='x'\n"), { A: "1", B: "two = 2", C: "x" });
  });
});

describe("checkVariables", () => {
  for (const environment of Object.keys(ENVIRONMENTS)) {
    it(`accepts the expected ${environment} values`, () => {
      assert.deepEqual(checkVariables(environment, parseEnvList(ENV_LIST), goodPulled(environment)), []);
    });
  }

  it("rejects production pointing at the staging API", () => {
    const pulled = { ...goodPulled("production"), EXPO_PUBLIC_API_URL: "https://staging.api.stigvidd.se/api/v1" };
    const errors = checkVariables("production", [], pulled);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /EXPO_PUBLIC_API_URL/);
  });

  it("rejects preview on the production realm", () => {
    const pulled = { ...goodPulled("preview"), EXPO_PUBLIC_OIDC_REALM: "stigvidd" };
    assert.match(checkVariables("preview", [], pulled).join(), /EXPO_PUBLIC_OIDC_REALM/);
  });

  it("rejects a missing logs token", () => {
    const { EXPO_PUBLIC_OO_LOGS_TOKEN: _, ...pulled } = goodPulled("production");
    assert.match(checkVariables("production", [], pulled).join(), /EXPO_PUBLIC_OO_LOGS_TOKEN/);
  });

  it("rejects a variable shared by preview and production", () => {
    const listed = [{ name: "EXPO_PUBLIC_LOG_LEVEL", value: "debug", environments: ["preview", "production"] }];
    assert.match(
      checkVariables("production", listed, goodPulled("production")).join(),
      /EXPO_PUBLIC_LOG_LEVEL is shared/,
    );
  });

  it("rejects an unknown environment", () => {
    assert.deepEqual(checkVariables("staging", [], {}), ['Unknown environment "staging"']);
  });
});

describe("checkBundle", () => {
  for (const environment of Object.keys(ENVIRONMENTS)) {
    it(`accepts a ${environment} bundle`, () => {
      assert.deepEqual(checkBundle(environment, goodBundle(environment)), []);
    });
  }

  it("rejects a production bundle that also carries the staging realm", () => {
    const bundle = [{ file: "index.hbc", content: `${goodBundle("production")[0].content} stigvidd-staging` }];
    assert.match(checkBundle("production", bundle).join(), /stigvidd-staging/);
  });

  it("rejects a preview bundle that carries the production API", () => {
    const bundle = [
      { file: "index.hbc", content: `${goodBundle("preview")[0].content} https://api.stigvidd.se/api/v1` },
    ];
    assert.match(checkBundle("preview", bundle).join(), /api\.stigvidd\.se/);
  });

  it("rejects a bundle without the expected API", () => {
    assert.match(checkBundle("production", [{ file: "index.hbc", content: "" }]).join(), /does not contain/);
  });

  it("rejects an export without bundles", () => {
    assert.deepEqual(checkBundle("production", []), ["No JavaScript bundle found in the export"]);
  });
});
