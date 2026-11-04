// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { MediaFilter } from "@/api/generated/model";

// keep-comment: matchingCount is what the listing last counted, not a promise - the server re-expands the filter when the job is created, so the two can differ if the library changed in between
export type ReprocessTarget =
  | { kind: "ids"; mediaIdentifiers: string[] }
  | { kind: "filter"; filter: MediaFilter; matchingCount: number; summary: string };

export function targetCount(target: ReprocessTarget): number {
  return target.kind === "ids" ? target.mediaIdentifiers.length : target.matchingCount;
}
