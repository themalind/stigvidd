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

type FormatKind = "weekday" | "month" | "clock" | "dayMonth" | "longDate";

const FORMAT_OPTIONS: Record<FormatKind, Intl.DateTimeFormatOptions> = {
  weekday: { weekday: "short" },
  month: { month: "short" },
  clock: { hour: "2-digit", minute: "2-digit" },
  dayMonth: { day: "numeric", month: "short" },
  longDate: { weekday: "long", day: "numeric", month: "long" },
};

const formatters = new Map<string, Intl.DateTimeFormat>();

// Hermes builds a new formatter on every toLocale*String call, which is slow in a long list. keep-comment: why formatters are cached
function format(date: Date, language: string, kind: FormatKind): string {
  const key = `${language}|${kind}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(language, FORMAT_OPTIONS[kind]);
    formatters.set(key, formatter);
  }
  return formatter.format(date);
}

export function dateBadgeParts(iso: string, language: string): DateBadgeParts {
  const date = new Date(iso);
  return {
    weekday: trimDot(format(date, language, "weekday")),
    day: String(date.getDate()),
    month: trimDot(format(date, language, "month")),
  };
}

export function formatClock(iso: string, language: string): string {
  return format(new Date(iso), language, "clock");
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
  return `${trimDot(format(date, language, "dayMonth"))} ${formatClock(iso, language)}`;
}

export function formatEventDate(iso: string, language: string): string {
  return format(new Date(iso), language, "longDate");
}
