// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// keep-comment: an unrecognized realm (typo, renamed env) must read as non-prod, not as prod
export function isStagingRealm(realm: string): boolean {
  return realm !== "stigvidd";
}

export const isStaging = isStagingRealm(import.meta.env.VITE_OIDC_REALM);
