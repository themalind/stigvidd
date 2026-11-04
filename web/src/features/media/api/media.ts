// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminMediaCancelReprocessJob,
  adminMediaCreateReprocessJob,
  adminMediaGetAll,
  adminMediaRetryReprocessJob,
  adminMediaUpdateMetadata,
  getAdminMediaGetAllQueryOptions,
  getAdminMediaGetAllUrl,
  getAdminMediaGetReprocessJobQueryOptions,
  getAdminMediaGetReprocessJobsSuspenseQueryOptions,
  getAdminMediaGetReprocessJobsUrl,
} from "@/api/generated/admin-media/admin-media";
import type {
  AdminMediaGetAllParams,
  MediaItemResponse,
  MediaReprocessJobDetailResponse,
  MediaReprocessJobSummaryResponse,
  UpdateImageMetadataRequest,
} from "@/api/generated/model";
import { addFacilityImages, addTrailImages, deleteFacilityImage, deleteTrailImage, setTrailSymbol } from "@/api/images";
import type { ImageProcessingOptions } from "@/api/image-options";
import { underUrl } from "@/lib/react-query";
import { groupFailures } from "@/features/media/utils/media-reprocess-failures";
import type { TargetType } from "@/features/media/utils/media-upload";
import type { ReprocessTarget } from "@/features/media/utils/media-reprocess-target";

const ADMIN_MEDIA = getAdminMediaGetAllUrl();
const REPROCESS_JOBS = getAdminMediaGetReprocessJobsUrl();
const POLL_MS = 3000;
const JOBS_PAGE = { page: 1, pageSize: 50 };

export const mediaLibraryQueryOptions = (params: AdminMediaGetAllParams) =>
  getAdminMediaGetAllQueryOptions(params, { query: { placeholderData: keepPreviousData } });

// keep-comment: the listing caps a page at 200, so one owner is walked page by page, up to a ceiling a server that always says "more" cannot spin past
const OWNER_PAGE_SIZE = 200;
const OWNER_MAX_PAGES = 20;

export async function getMediaForOwner(ownerIdentifier: string): Promise<MediaItemResponse[]> {
  const items: MediaItemResponse[] = [];

  for (let page = 1; page <= OWNER_MAX_PAGES; page++) {
    const result = await adminMediaGetAll({ OwnerIdentifier: ownerIdentifier, Page: page, PageSize: OWNER_PAGE_SIZE });
    items.push(...result.items);
    if (!result.hasMore) break;
  }

  return items;
}

export const ownerMediaQueryOptions = (ownerIdentifier: string) =>
  queryOptions({
    queryKey: [ADMIN_MEDIA, "owner", ownerIdentifier],
    queryFn: () => getMediaForOwner(ownerIdentifier),
    enabled: ownerIdentifier !== "",
  });

export function useInvalidateMedia() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries(underUrl(ADMIN_MEDIA));
}

export type UploadRequest = {
  targetType: TargetType;
  targetId: string;
  files: File[];
  options: ImageProcessingOptions;
};

async function upload({ targetType, targetId, files, options }: UploadRequest): Promise<string> {
  if (targetType === "trail-symbol") {
    await setTrailSymbol(targetId, files[0], options);
    return "Trail symbol updated.";
  }

  if (targetType === "trail-gallery") {
    const added = await addTrailImages(targetId, files, options);
    return `${added.length} image(s) added to trail.`;
  }

  const added = await addFacilityImages(targetId, files, options);
  return `${added.length} image(s) added to facility.`;
}

export function useUploadImages(onTrailImagesChanged: () => void) {
  const invalidate = useInvalidateMedia();

  return useMutation({
    mutationFn: upload,
    onSuccess: (message, { targetType }) => {
      toast.success(message);
      if (targetType !== "facility") onTrailImagesChanged();
      return invalidate();
    },
    meta: { errorMessage: "Upload failed." },
  });
}

export function useDeleteImage(onTrailImagesChanged: () => void) {
  const invalidate = useInvalidateMedia();

  return useMutation({
    mutationFn: (item: Pick<MediaItemResponse, "identifier" | "ownerType">) =>
      item.ownerType === "Trail" ? deleteTrailImage(item.identifier) : deleteFacilityImage(item.identifier),
    onSuccess: (_result, { ownerType }) => {
      if (ownerType === "Trail") onTrailImagesChanged();
      return invalidate();
    },
    meta: { successMessage: "Image deleted.", errorMessage: "Failed to delete image." },
  });
}

export function useUpdateMediaMetadata() {
  const invalidate = useInvalidateMedia();

  return useMutation({
    mutationFn: ({ identifier, ...metadata }: UpdateImageMetadataRequest & { identifier: string }) =>
      adminMediaUpdateMetadata(identifier, metadata),
    onSuccess: invalidate,
    meta: { successMessage: "Metadata saved." },
  });
}

export type ReprocessJobSummary = MediaReprocessJobSummaryResponse;

const isActive = (job: ReprocessJobSummary) => job.status === "Pending" || job.status === "Processing";

export const reprocessJobsQueryOptions = () =>
  getAdminMediaGetReprocessJobsSuspenseQueryOptions(JOBS_PAGE, {
    query: {
      refetchInterval: ({ state }) => (state.data?.items.some(isActive) ? POLL_MS : false),
      meta: { errorMessage: "Failed to load batch jobs." },
    },
  });

const toFailures = (detail: MediaReprocessJobDetailResponse) => groupFailures(detail.items);

export const reprocessFailuresQueryOptions = (identifier: string) =>
  getAdminMediaGetReprocessJobQueryOptions(identifier, { query: { select: toFailures } });

function useInvalidateJobs() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries(underUrl(REPROCESS_JOBS));
}

export function useEnqueueReprocess() {
  const invalidateJobs = useInvalidateJobs();

  return useMutation({
    mutationFn: ({ target, options }: { target: ReprocessTarget; options: ImageProcessingOptions }) =>
      adminMediaCreateReprocessJob(
        target.kind === "ids"
          ? { mediaIdentifiers: target.mediaIdentifiers, options }
          : { filter: target.filter, options },
      ),
    // keep-comment: the job's own totalCount, not the dialog's - in filter mode the server expands the filter again when the job is created
    onSuccess: (job) => {
      toast.success(`Batch started for ${job.totalCount} image(s).`);
      return invalidateJobs();
    },
  });
}

export function useCancelReprocessJob() {
  const invalidateJobs = useInvalidateJobs();

  return useMutation({
    mutationFn: (identifier: string) => adminMediaCancelReprocessJob(identifier),
    onSuccess: invalidateJobs,
    meta: { errorMessage: "Failed to cancel the batch." },
  });
}

export function useRetryReprocessJob() {
  const invalidateJobs = useInvalidateJobs();

  return useMutation({
    mutationFn: (identifier: string) => adminMediaRetryReprocessJob(identifier),
    onSuccess: (retried) => {
      toast.success(`Retrying ${retried.pendingCount} failed image(s).`);
      return invalidateJobs();
    },
    meta: { errorMessage: "Failed to retry the batch." },
  });
}
