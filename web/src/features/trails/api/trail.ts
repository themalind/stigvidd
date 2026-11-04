// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ImageProcessingOptions } from "@/types/types";
import {
  adminTrailsGetAllTrails,
  adminTrailsSetTrailVerified,
  adminTrailsUpdateTrail,
  getAdminTrailsAddTrailImagesUrl,
  getAdminTrailsDeleteTrailImageUrl,
  getAdminTrailsGetAllTrailsQueryKey,
  getAdminTrailsGetAllTrailsSuspenseQueryOptions,
  getAdminTrailsGetTrailPathSuspenseQueryOptions,
  getAdminTrailsGetTrailQueryKey,
  getAdminTrailsGetTrailSuspenseQueryOptions,
  getAdminTrailsSetTrailSymbolUrl,
} from "@/api/generated/admin-trails/admin-trails";
import type {
  AdminTrailListItemResponse,
  TrailImageResponse,
  TrailSymbolResponse,
  UpdateTrailRequest,
} from "@/api/generated/model";
import { customFetch } from "@/api/mutator";
import type { LngLat } from "@/utils/geometry-edit";
import { appendProcessingOptions } from "@/api/image-options";

export const trailsQueryOptions = () => getAdminTrailsGetAllTrailsSuspenseQueryOptions();

export const trailQueryOptions = (identifier: string) => getAdminTrailsGetTrailSuspenseQueryOptions(identifier);

export const trailPathQueryOptions = (identifier: string) =>
  getAdminTrailsGetTrailPathSuspenseQueryOptions(identifier, {
    query: {
      select: ({ coordinates }): LngLat[] => (coordinates ?? []).filter((pair): pair is LngLat => pair.length === 2),
    },
  });

export function getAllTrails(): Promise<AdminTrailListItemResponse[]> {
  return adminTrailsGetAllTrails();
}

// keep-comment: the generated multipart client expands a File's own properties into fields, so the body is built here
export function addTrailImages(
  identifier: string,
  images: File[],
  options?: ImageProcessingOptions,
): Promise<TrailImageResponse[]> {
  const formData = new FormData();
  images.forEach((file) => formData.append("images", file));
  appendProcessingOptions(formData, options);
  return customFetch<TrailImageResponse[]>(getAdminTrailsAddTrailImagesUrl(identifier), {
    method: "POST",
    body: formData,
  });
}

export function setTrailSymbol(
  identifier: string,
  symbol: File,
  options?: ImageProcessingOptions,
): Promise<TrailSymbolResponse> {
  const formData = new FormData();
  formData.append("symbol", symbol);
  appendProcessingOptions(formData, options);
  return customFetch<TrailSymbolResponse>(getAdminTrailsSetTrailSymbolUrl(identifier), {
    method: "POST",
    body: formData,
  });
}

export async function deleteTrailImage(imageIdentifier: string): Promise<void> {
  await customFetch<void>(getAdminTrailsDeleteTrailImageUrl(imageIdentifier), { method: "DELETE" });
}

export function useSetTrailVerified(trail: Pick<AdminTrailListItemResponse, "identifier" | "name">) {
  const queryClient = useQueryClient();
  const listKey = trailsQueryOptions().queryKey;

  return useMutation({
    mutationFn: async (isVerified: boolean) => {
      await adminTrailsSetTrailVerified(trail.identifier, { isVerified });
    },
    onMutate: async (isVerified) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData(listKey);
      queryClient.setQueryData(listKey, (current) =>
        current?.map((row) => (row.identifier === trail.identifier ? { ...row, isVerified } : row)),
      );
      return { previous };
    },
    onError: (_error, _isVerified, context) => {
      queryClient.setQueryData(listKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: listKey }),
    meta: { errorMessage: `Failed to update ${trail.name}.` },
  });
}

export function useUpdateTrail(identifier: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateTrailRequest) => adminTrailsUpdateTrail(identifier, request),
    onSuccess: (saved) => {
      queryClient.setQueryData(getAdminTrailsGetTrailQueryKey(identifier), saved);
      return queryClient.invalidateQueries({ queryKey: getAdminTrailsGetAllTrailsQueryKey() });
    },
    meta: { successMessage: "Trail updated successfully.", errorMessage: "Failed to update trail." },
  });
}

function useInvalidateTrail(identifier: string) {
  const queryClient = useQueryClient();

  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getAdminTrailsGetTrailQueryKey(identifier) }),
      queryClient.invalidateQueries({ queryKey: getAdminTrailsGetAllTrailsQueryKey() }),
    ]);
}

export function useAddTrailImages(identifier: string) {
  const invalidate = useInvalidateTrail(identifier);

  return useMutation({
    mutationFn: (files: File[]) => addTrailImages(identifier, files),
    onSuccess: invalidate,
    meta: { errorMessage: "Failed to upload images." },
  });
}

export function useDeleteTrailImage(identifier: string) {
  const invalidate = useInvalidateTrail(identifier);

  return useMutation({
    mutationFn: (imageIdentifier: string) => deleteTrailImage(imageIdentifier),
    onSuccess: invalidate,
    meta: { successMessage: "Image deleted.", errorMessage: "Failed to delete image." },
  });
}
