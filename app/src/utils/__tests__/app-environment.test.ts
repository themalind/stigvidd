// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { resolveAppEnvironment } from "@/utils/app-environment";

const PRODUCTION_API = "https://api.stigvidd.se/api/v1";
const STAGING_API = "https://staging.api.stigvidd.se/api/v1";

it("recognises production", () => {
  expect(resolveAppEnvironment(PRODUCTION_API, "stigvidd")).toBe("production");
});

it("recognises staging", () => {
  expect(resolveAppEnvironment(STAGING_API, "stigvidd-staging")).toBe("staging");
});

it("calls the staging API with the production realm mixed", () => {
  expect(resolveAppEnvironment(STAGING_API, "stigvidd")).toBe("mixed");
});

it("calls the production API with the staging realm mixed", () => {
  expect(resolveAppEnvironment(PRODUCTION_API, "stigvidd-staging")).toBe("mixed");
});

it("does not guess when a variable is missing", () => {
  expect(resolveAppEnvironment(undefined, "stigvidd")).toBe("unknown");
  expect(resolveAppEnvironment(STAGING_API, "")).toBe("unknown");
});
