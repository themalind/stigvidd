// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SharedHike } from "@/data/types";

const newestFirst = (a: SharedHike, b: SharedHike) => Date.parse(b.sharedAt) - Date.parse(a.sharedAt);

export function latestShareBySender(hikes: readonly SharedHike[]): Map<string, SharedHike> {
  const latest = new Map<string, SharedHike>();
  for (const hike of hikes) {
    if (!hike.sharedByIdentifier) continue;
    const current = latest.get(hike.sharedByIdentifier);
    if (!current || newestFirst(hike, current) < 0) latest.set(hike.sharedByIdentifier, hike);
  }
  return latest;
}

export function sharesFrom(hikes: readonly SharedHike[], senderIdentifier: string): SharedHike[] {
  return hikes.filter((h) => h.sharedByIdentifier === senderIdentifier).sort(newestFirst);
}
