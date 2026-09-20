// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ImageProcessingOptions, MediaItemResponse } from "@/types/types";
import {
  adminMediaCancelReprocessJob,
  adminMediaCreateReprocessJob,
  adminMediaGetAll,
  adminMediaGetReprocessJob,
  adminMediaGetReprocessJobs,
  adminMediaUpdateMetadata,
} from "./generated/admin-media/admin-media";
import type {
  MediaReprocessJobDetailResponse,
  MediaReprocessJobSummaryResponse,
  PagedResultOfMediaReprocessJobSummaryResponse,
} from "./generated/model";

// See trail.ts for the wrapper rationale — delegates to the generated client
// while keeping the app's existing signatures. Auth + base URL come from the
// `customFetch` mutator the generated functions call.

export async function getAllMedia(): Promise<MediaItemResponse[]> {
  return (await adminMediaGetAll()) as MediaItemResponse[];
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
