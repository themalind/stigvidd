// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminHikeSubmissionsApproveSubmission,
  adminHikeSubmissionsDeleteSubmissionImage,
  adminHikeSubmissionsRejectSubmission,
  adminHikeSubmissionsUpdateSubmission,
  adminHikeSubmissionsUpdateSubmissionGeometry,
  getAdminHikeSubmissionsGetSimilarRoutesQueryKey,
  getAdminHikeSubmissionsGetSimilarRoutesSuspenseQueryOptions,
  getAdminHikeSubmissionsGetSubmissionsQueryKey,
  getAdminHikeSubmissionsGetSubmissionsSuspenseQueryOptions,
  getAdminHikeSubmissionsGetSubmissionSuspenseQueryOptions,
} from "@/api/generated/admin-hike-submissions/admin-hike-submissions";
import type {
  AdminHikeSubmissionResponse,
  HikeSubmissionStatus,
  UpdateHikeSubmissionRequest,
} from "@/api/generated/model";

export const submissionsQueryOptions = (status: HikeSubmissionStatus) =>
  getAdminHikeSubmissionsGetSubmissionsSuspenseQueryOptions({ status });

export const submissionQueryOptions = (identifier: string) =>
  getAdminHikeSubmissionsGetSubmissionSuspenseQueryOptions(identifier);

export const similarRoutesQueryOptions = (identifier: string) =>
  getAdminHikeSubmissionsGetSimilarRoutesSuspenseQueryOptions(identifier);

function useSubmissionCache(identifier: string) {
  const queryClient = useQueryClient();
  const detailKey = submissionQueryOptions(identifier).queryKey;

  return {
    store: (updated: AdminHikeSubmissionResponse) => queryClient.setQueryData(detailKey, updated),
    update: (change: (current: AdminHikeSubmissionResponse) => AdminHikeSubmissionResponse) =>
      queryClient.setQueryData(detailKey, (current) => current && change(current)),
    invalidateLists: () => queryClient.invalidateQueries({ queryKey: getAdminHikeSubmissionsGetSubmissionsQueryKey() }),
    invalidateDetail: () => queryClient.invalidateQueries({ queryKey: detailKey }),
    invalidateSimilar: () =>
      queryClient.invalidateQueries({ queryKey: getAdminHikeSubmissionsGetSimilarRoutesQueryKey(identifier) }),
  };
}

export function useSaveSubmissionRoute(identifier: string) {
  const cache = useSubmissionCache(identifier);

  return useMutation({
    mutationFn: (coordinates: string) => adminHikeSubmissionsUpdateSubmissionGeometry(identifier, { coordinates }),
    onSuccess: (updated) => {
      cache.store(updated);
      return Promise.all([cache.invalidateSimilar(), cache.invalidateLists()]);
    },
    meta: { successMessage: "Route saved.", errorMessage: "Could not save the route." },
  });
}

export function useSaveSubmissionDetails(identifier: string) {
  const cache = useSubmissionCache(identifier);

  return useMutation({
    mutationFn: (details: UpdateHikeSubmissionRequest) => adminHikeSubmissionsUpdateSubmission(identifier, details),
    onSuccess: (updated) => {
      cache.store(updated);
      return cache.invalidateLists();
    },
    meta: {
      successMessage: "Details saved.",
      errorMessage: "Could not save the details. If the trail was changed elsewhere, reload the page and try again.",
    },
  });
}

export function useDeleteSubmissionImage(identifier: string) {
  const cache = useSubmissionCache(identifier);

  return useMutation({
    mutationFn: (imageIdentifier: string) => adminHikeSubmissionsDeleteSubmissionImage(identifier, imageIdentifier),
    onSuccess: (_, imageIdentifier) => {
      cache.update((current) => ({
        ...current,
        images: current.images.filter((image) => image.identifier !== imageIdentifier),
      }));
      return cache.invalidateLists();
    },
    meta: { errorMessage: "Could not remove the photo." },
  });
}

export function useApproveSubmission(identifier: string) {
  const cache = useSubmissionCache(identifier);

  return useMutation({
    mutationFn: () => adminHikeSubmissionsApproveSubmission(identifier),
    onSuccess: () => Promise.all([cache.invalidateDetail(), cache.invalidateLists()]),
    meta: { successMessage: "Published as a user walk.", errorMessage: "Could not approve the submission." },
  });
}

export function useRejectSubmission(identifier: string) {
  const cache = useSubmissionCache(identifier);

  return useMutation({
    mutationFn: (reason: string) => adminHikeSubmissionsRejectSubmission(identifier, { reason }),
    onSuccess: () => Promise.all([cache.invalidateDetail(), cache.invalidateLists()]),
    meta: { successMessage: "Submission rejected.", errorMessage: "Could not reject the submission." },
  });
}
