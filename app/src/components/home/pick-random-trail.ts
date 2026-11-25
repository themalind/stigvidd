// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// keep-comment: skips the previous pick unless it is the only one left
export function pickRandomTrail<T extends { identifier: string }>(
  trails: readonly T[],
  excludeIdentifier?: string,
  random: () => number = Math.random,
): T | null {
  if (trails.length === 0) {
    return null;
  }

  const pool = excludeIdentifier ? trails.filter((trail) => trail.identifier !== excludeIdentifier) : trails;
  const candidates = pool.length > 0 ? pool : trails;

  // keep-comment: a value close enough to 1 would index one past the end
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[index] ?? null;
}
