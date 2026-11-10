// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// How long ago a walk was, for the home screen card. "för 5 dagar sedan" carries
// more than a date does at a glance — but only while the walk is recent, so older
// ones fall back to formatDate at the call site.
const MAX_RELATIVE_DAYS = 30;

export type RelativeDayKey = "hike.today" | "hike.yesterday" | "hike.daysAgo";

export interface RelativeDay {
  key: RelativeDayKey;
  /** Passed to i18next for pluralisation; always 0 or 1 for today and yesterday. */
  count: number;
}

// Midnight local time, so "yesterday" means the previous calendar day rather than
// 24 hours back — an evening walk is still "yesterday" the next morning.
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Returns null when the date is unparseable, in the future, or too old to phrase relatively. */
export function relativeDay(dateString: string, now: Date = new Date()): RelativeDay | null {
  const parsed = Date.parse(dateString);
  if (Number.isNaN(parsed)) return null;

  const days = Math.round((startOfDay(now) - startOfDay(new Date(parsed))) / 86400000);

  if (days < 0 || days > MAX_RELATIVE_DAYS) return null;
  if (days === 0) return { key: "hike.today", count: 0 };
  if (days === 1) return { key: "hike.yesterday", count: 1 };
  return { key: "hike.daysAgo", count: days };
}
