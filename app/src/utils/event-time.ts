// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

export interface DateBadgeParts {
  weekday: string;
  day: string;
  month: string;
}

function trimDot(text: string): string {
  return text.replace(/\.$/, "");
}

export function dateBadgeParts(iso: string, language: string): DateBadgeParts {
  const date = new Date(iso);
  return {
    weekday: trimDot(date.toLocaleDateString(language, { weekday: "short" })),
    day: String(date.getDate()),
    month: trimDot(date.toLocaleDateString(language, { month: "short" })),
  };
}

export function formatClock(iso: string, language: string): string {
  return new Date(iso).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// "12:00–13:00", or only the start when the end is on another day or missing. keep-comment: the date badge shows the day
export function formatTimeRange(startsAt: string, endsAt: string | null | undefined, language: string): string {
  const start = formatClock(startsAt, language);
  if (!endsAt || !sameDay(new Date(startsAt), new Date(endsAt))) return start;
  return `${start}–${formatClock(endsAt, language)}`;
}

export function formatPostTime(iso: string, language: string): string {
  const date = new Date(iso);
  return `${trimDot(date.toLocaleDateString(language, { day: "numeric", month: "short" }))} ${formatClock(iso, language)}`;
}

export function formatEventDate(iso: string, language: string): string {
  return new Date(iso).toLocaleDateString(language, { weekday: "long", day: "numeric", month: "long" });
}
