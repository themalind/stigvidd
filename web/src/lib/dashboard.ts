// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Session } from "@/api/trail-import";
import type { AdminTrailListItem } from "@/types/types";

export type TrailStats = {
  total: number;
  inactive: number;
  withExampleImages: number;
  withoutImages: number;
  withoutDescription: number;
};

export function trailStats(trails: AdminTrailListItem[]): TrailStats {
  return {
    total: trails.length,
    inactive: trails.filter((t) => !t.isVerified).length,
    withExampleImages: trails.filter((t) => t.hasExampleImages).length,
    withoutImages: trails.filter((t) => !t.hasImages).length,
    withoutDescription: trails.filter((t) => !t.hasDescription).length,
  };
}

export function importsAwaitingReview(sessions: Session[]): number {
  return sessions.filter((s) => s.status === "AwaitingReview").length;
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

export function relativeTime(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function share(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}
