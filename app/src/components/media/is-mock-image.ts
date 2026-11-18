// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// keep-comment: mock images have "mock" in their path (trails/mock/…, trails/area-mock.jpg); uploads never do
export function isMockImage(source: unknown): boolean {
  const uri =
    typeof source === "string"
      ? source
      : typeof source === "object" && source !== null && "uri" in source
        ? String((source as { uri?: unknown }).uri ?? "")
        : "";
  return uri.toLowerCase().includes("mock");
}
