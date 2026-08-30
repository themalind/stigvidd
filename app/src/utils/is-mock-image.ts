// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

/**
 * Mock images are recognized by their path: trails live under ".../trails/mock/..."
 * (e.g. "mock/gesebol/20250824100243.jpg", "mock/vindskydd_mock.jpg") and areas
 * use ".../trails/area-mock.jpg". They all live on stigvidd.se and contain "mock"
 * in the URL. Real uploaded images have no "mock", so the "Example image" badge
 * disappears automatically once they are replaced.
 *
 * Handles the source formats expo-image accepts: a string URL, a { uri } object,
 * or a local require (number) — where local requires are never mock.
 */
export function isMockImage(source: unknown): boolean {
  const uri =
    typeof source === "string"
      ? source
      : typeof source === "object" && source !== null && "uri" in source
        ? String((source as { uri?: unknown }).uri ?? "")
        : "";
  return uri.toLowerCase().includes("mock");
}
