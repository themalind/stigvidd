// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ImageProcessingOptions } from "@/types/types";
import {
  adminMediaCancelReprocessJob,
  adminMediaCreateReprocessJob,
  adminMediaGetAll,
  adminMediaGetReprocessJob,
  adminMediaGetReprocessJobs,
  adminMediaUpdateMetadata,
} from "./generated/admin-media/admin-media";
import type {
  AdminMediaGetAllParams,
  MediaFilter,
  MediaItemResponse,
  MediaLibraryPageResponse,
  MediaReprocessJobDetailResponse,
  MediaReprocessJobSummaryResponse,
  PagedResultOfMediaReprocessJobSummaryResponse,
} from "./generated/model";

// See trail.ts for the wrapper rationale — delegates to the generated client
// while keeping the app's existing signatures. Auth + base URL come from the
// `customFetch` mutator the generated functions call.

export async function getMedia(
  params: AdminMediaGetAllParams,
): Promise<MediaLibraryPageResponse> {
  return adminMediaGetAll(params);
}

// The listing endpoint caps a page at 200 and no longer returns the whole library at once,
// so one owner is asked for by filter and walked page by page.
const OwnerPageSize = 200;
const OwnerMaxPages = 20;

export async function getMediaForOwner(
  ownerIdentifier: string,
): Promise<MediaItemResponse[]> {
  const items: MediaItemResponse[] = [];

  // A ceiling rather than a while (hasMore), the same guard collectAllMatching uses: a server
  // that always says there is more would otherwise spin in the browser.
  for (let page = 1; page <= OwnerMaxPages; page++) {
    const result = await adminMediaGetAll({
      OwnerIdentifier: ownerIdentifier,
      Page: page,
      PageSize: OwnerPageSize,
    });
    items.push(...result.items);
    if (!result.hasMore) break;
  }

  return items;
}

export async function updateImageMetadata(
  imageIdentifier: string,
  metadata: { altText?: string | null; caption?: string | null },
): Promise<void> {
  await adminMediaUpdateMetadata(imageIdentifier, metadata);
}

export type ReprocessJobSummary = MediaReprocessJobSummaryResponse;
export type ReprocessJobDetail = MediaReprocessJobDetailResponse;

/** Submits already-stored Trail/Facility images for background resize/re-encode. */
export async function enqueueMediaReprocessJob(
  mediaIdentifiers: string[],
  options: ImageProcessingOptions,
): Promise<ReprocessJobSummary> {
  return adminMediaCreateReprocessJob({ mediaIdentifiers, options });
}

// keep-comment: the server re-expands the filter when the job is created, so a batch larger than the request cap never travels as identifiers
export async function enqueueMediaReprocessJobForFilter(
  filter: MediaFilter,
  options: ImageProcessingOptions,
): Promise<ReprocessJobSummary> {
  return adminMediaCreateReprocessJob({ filter, options });
}

export async function getMediaReprocessJobs(
  page: number,
  pageSize: number,
): Promise<PagedResultOfMediaReprocessJobSummaryResponse> {
  return adminMediaGetReprocessJobs({ page, pageSize });
}

export async function getMediaReprocessJob(identifier: string): Promise<ReprocessJobDetail> {
  return adminMediaGetReprocessJob(identifier);
}

/** Cancels every item of a job still waiting to be processed. */
export async function cancelMediaReprocessJob(identifier: string): Promise<ReprocessJobSummary> {
  return adminMediaCancelReprocessJob(identifier);
}
