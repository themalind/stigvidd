// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// True when a fetch got no response at all. keep-comment: expo/fetch (the global fetch since SDK 58) rejects with "fetch failed: …", React Native's own with this TypeError, and neither exports a class
export function isFetchFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.startsWith("fetch failed:") || error.message === "Network request failed";
}
