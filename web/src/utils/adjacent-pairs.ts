// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

export function adjacentPairs<T>(items: readonly T[]): [T, T][] {
  const pairs: [T, T][] = [];
  let previous: { item: T } | null = null;
  for (const item of items) {
    if (previous) pairs.push([previous.item, item]);
    previous = { item };
  }
  return pairs;
}
