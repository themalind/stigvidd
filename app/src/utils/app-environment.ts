// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

export type AppEnvironment = "production" | "staging" | "mixed" | "unknown";

const PRODUCTION_REALM = "stigvidd";

/** Which backend this build talks to; "mixed" when the API and the Keycloak realm disagree. */
export function resolveAppEnvironment(apiUrl: string | undefined, realm: string | undefined): AppEnvironment {
  if (!apiUrl || !realm) return "unknown";
  const stagingApi = apiUrl.includes("staging");
  const stagingRealm = realm !== PRODUCTION_REALM;
  if (stagingApi !== stagingRealm) return "mixed";
  return stagingApi ? "staging" : "production";
}

export const APP_ENVIRONMENT = resolveAppEnvironment(
  process.env.EXPO_PUBLIC_API_URL,
  process.env.EXPO_PUBLIC_OIDC_REALM,
);
