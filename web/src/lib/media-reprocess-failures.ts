// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { MediaReprocessItemResponse } from "@/api/generated/model";

export type FailureGroup = {
  reason: string;
  mediaIdentifiers: string[];
};

const UNKNOWN_REASON = "No reason recorded";

export function groupFailures(items: MediaReprocessItemResponse[]): FailureGroup[] {
  const byReason = new Map<string, string[]>();

  for (const item of items) {
    if (item.status !== "Failed") continue;

    const reason = item.lastError?.trim() || UNKNOWN_REASON;
    const group = byReason.get(reason);
    if (group) group.push(item.mediaIdentifier);
    else byReason.set(reason, [item.mediaIdentifier]);
  }

  return [...byReason.entries()]
    .map(([reason, mediaIdentifiers]) => ({ reason, mediaIdentifiers }))
    .sort((a, b) => b.mediaIdentifiers.length - a.mediaIdentifiers.length || a.reason.localeCompare(b.reason));
}
