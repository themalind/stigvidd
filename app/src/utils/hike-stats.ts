// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Hike, SharedHike } from "@/data/types";

export interface HikeStats {
  count: number;
  /** Summed hikeLength, in kilometres. */
  totalKm: number;
  /** Summed duration, in milliseconds. */
  totalMs: number;
}

export function summarizeHikes(hikes: readonly Hike[]): HikeStats {
  let totalKm = 0;
  let totalMs = 0;
  for (const hike of hikes) {
    if (Number.isFinite(hike.hikeLength)) totalKm += hike.hikeLength;
    if (Number.isFinite(hike.duration)) totalMs += hike.duration;
  }
  return { count: hikes.length, totalKm, totalMs };
}

export interface SharedHikeStats {
  count: number;
  /** Summed hikeLength, in kilometres. Distance received, not distance walked. */
  totalKm: number;
  /** How many distinct people have shared something with you. */
  senderCount: number;
  /** The one person worth naming, and on what grounds. Absent only for an empty list. */
  featured?: { name: string; kind: "most" | "latest" };
}

// Totals plus the people behind them: how many have shared, and the one worth naming.
export function summarizeSharedHikes(hikes: readonly SharedHike[]): SharedHikeStats {
  let totalKm = 0;
  const shareCounts = new Map<string, number>();
  let latestName: string | undefined;
  let latestTime = -Infinity;

  for (const hike of hikes) {
    if (Number.isFinite(hike.hikeLength)) totalKm += hike.hikeLength;
    shareCounts.set(hike.sharedByName, (shareCounts.get(hike.sharedByName) ?? 0) + 1);

    // An unparseable date gives NaN, which loses every comparison and drops out here.
    const time = Date.parse(hike.sharedAt);
    if (time > latestTime) {
      latestTime = time;
      latestName = hike.sharedByName;
    }
  }

  let highest = 0;
  let leaderCount = 0;
  let leader: string | undefined;
  for (const [name, count] of shareCounts) {
    if (count > highest) {
      highest = count;
      leaderCount = 1;
      leader = name;
    } else if (count === highest) {
      leaderCount++;
    }
  }

  // "Most" needs one sender strictly ahead of a field of several; ties and lone senders
  // fall back to the latest share, which also names exactly one person.
  const featured =
    leaderCount === 1 && leader && shareCounts.size > 1
      ? ({ name: leader, kind: "most" } as const)
      : latestName
        ? ({ name: latestName, kind: "latest" } as const)
        : undefined;

  return { count: hikes.length, totalKm, senderCount: shareCounts.size, featured };
}

/** The most recently recorded hike, or undefined when there are none. */
export function latestHike(hikes: readonly Hike[]): Hike | undefined {
  let latest: Hike | undefined;
  let latestTime = -Infinity;
  for (const hike of hikes) {
    // An unparseable date gives NaN, which loses every comparison and drops out here.
    const time = Date.parse(hike.createdAt);
    if (time > latestTime) {
      latestTime = time;
      latest = hike;
    }
  }
  return latest;
}

// A summed duration as a headline figure: minutes below an hour, then hours, dropping
// the decimal once the total passes ten.
export function formatTotalDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);

  if (minutes < 60) return `${Math.max(minutes, 0)} min`;

  const hours = ms / 3600000;
  const value = hours >= 10 ? Math.round(hours).toString() : (Math.round(hours * 10) / 10).toFixed(1).replace(".", ",");
  return `${value} h`;
}
