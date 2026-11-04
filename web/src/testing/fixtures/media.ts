// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  MediaItemResponse,
  MediaLibraryPageResponse,
  MediaReprocessItemResponse,
  MediaReprocessJobSummaryResponse,
  PagedResultOfMediaReprocessJobSummaryResponse,
} from "@/api/generated/model";

export function mediaItem(overrides: Partial<MediaItemResponse> = {}): MediaItemResponse {
  const identifier = overrides.identifier ?? "m1";
  return {
    identifier,
    imageUrl: `https://media.test/${identifier}.webp`,
    altText: `alt for ${identifier}`,
    caption: null,
    width: 800,
    height: 600,
    sizeBytes: 2048,
    createdAt: "2026-01-01T00:00:00Z",
    format: "webp",
    ownerType: "Trail",
    ownerIdentifier: "t-1",
    ownerName: "Knalleleden",
    ...overrides,
  };
}

export function libraryPage(
  items: MediaItemResponse[],
  overrides: Partial<MediaLibraryPageResponse> = {},
): MediaLibraryPageResponse {
  return {
    items,
    page: 1,
    hasMore: false,
    totalCount: items.length,
    reprocessableCount: items.filter((item) => item.ownerType !== "TrailSymbol").length,
    totalSizeBytes: items.reduce((sum, item) => sum + item.sizeBytes, 0),
    ...overrides,
  };
}

export function reprocessJob(
  overrides: Partial<MediaReprocessJobSummaryResponse> = {},
): MediaReprocessJobSummaryResponse {
  return {
    identifier: "job-1",
    status: "Pending",
    totalCount: 2,
    pendingCount: 2,
    processingCount: 0,
    succeededCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    createdAt: "2026-01-01T00:00:00Z",
    lastUpdatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

export function jobsPage(items: MediaReprocessJobSummaryResponse[]): PagedResultOfMediaReprocessJobSummaryResponse {
  return { items, page: 1, hasMore: false, totalCount: items.length };
}

export function failedItem(mediaIdentifier: string, lastError: string | null): MediaReprocessItemResponse {
  return {
    identifier: `item-${mediaIdentifier}`,
    mediaIdentifier,
    ownerType: "Trail",
    status: "Failed",
    lastError,
    createdAt: "2026-01-01T00:00:00Z",
    lastUpdatedAt: "2026-01-01T00:00:00Z",
  };
}
