// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminTrailsSetTrailVerified,
  adminTrailsUpdateTrail,
  getAdminTrailsGetAllTrailsQueryKey,
  getAdminTrailsGetAllTrailsSuspenseQueryOptions,
  getAdminTrailsGetAllTrailsUrl,
  getAdminTrailsGetTrailPathSuspenseQueryOptions,
  getAdminTrailsGetTrailQueryKey,
  getAdminTrailsGetTrailSuspenseQueryOptions,
} from "@/api/generated/admin-trails/admin-trails";
import type { AdminTrailListItemResponse, AdminTrailPathResponse, UpdateTrailRequest } from "@/api/generated/model";
import { addTrailImages, deleteTrailImage } from "@/api/images";
import { underUrl } from "@/lib/react-query";
import type { LngLat } from "@/utils/geometry-edit";

export const trailsQueryOptions = () => getAdminTrailsGetAllTrailsSuspenseQueryOptions();

export const trailQueryOptions = (identifier: string) => getAdminTrailsGetTrailSuspenseQueryOptions(identifier);

const toLngLats = ({ coordinates }: AdminTrailPathResponse): LngLat[] =>
  coordinates.filter((pair): pair is LngLat => pair.length === 2);

export const trailPathQueryOptions = (identifier: string) =>
  getAdminTrailsGetTrailPathSuspenseQueryOptions(identifier, { query: { select: toLngLats } });

export function useInvalidateTrailQueries() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries(underUrl(getAdminTrailsGetAllTrailsUrl()));
}

// keep-comment: removed, not invalidated, so the next read waits for the server instead of showing up to 30 s old data
export function useForgetTrail(identifier: string) {
  const queryClient = useQueryClient();

  return () => queryClient.removeQueries({ queryKey: getAdminTrailsGetTrailQueryKey(identifier), exact: true });
}

const SET_VERIFIED = ["admin-trails", "set-verified"];

export function useSetTrailVerified(trail: Pick<AdminTrailListItemResponse, "identifier" | "name">) {
  const queryClient = useQueryClient();
  const listKey = trailsQueryOptions().queryKey;

  function setRow(isVerified: boolean) {
    queryClient.setQueryData(listKey, (current) =>
      current?.map((row) => (row.identifier === trail.identifier ? { ...row, isVerified } : row)),
    );
  }

  return useMutation({
    mutationKey: SET_VERIFIED,
    mutationFn: async (isVerified: boolean) => {
      await adminTrailsSetTrailVerified(trail.identifier, { isVerified });
    },
    onMutate: async (isVerified) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      setRow(isVerified);
    },
    onSuccess: (_result, isVerified) => {
      toast.success(
        isVerified ? `${trail.name} is now active in the app.` : `${trail.name} is now hidden from the app.`,
      );
    },
    onError: (_error, isVerified) => setRow(!isVerified),
    // keep-comment: refetching while another toggle is in flight would show that row's old state until it settles
    onSettled: () =>
      queryClient.isMutating({ mutationKey: SET_VERIFIED }) === 1
        ? queryClient.invalidateQueries({ queryKey: listKey })
        : undefined,
    meta: { errorMessage: `Failed to update ${trail.name}.` },
  });
}

export function useUpdateTrail(identifier: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateTrailRequest) => adminTrailsUpdateTrail(identifier, request),
    // keep-comment: the PUT response carries no images or contribution, so it must not replace the cached detail
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: getAdminTrailsGetTrailQueryKey(identifier) }),
        queryClient.invalidateQueries({ queryKey: getAdminTrailsGetAllTrailsQueryKey() }),
      ]),
    meta: { successMessage: "Trail updated successfully.", errorMessage: "Failed to update trail." },
  });
}

export function useAddTrailImages(identifier: string) {
  const invalidate = useInvalidateTrailQueries();

  return useMutation({
    mutationFn: (files: File[]) => addTrailImages(identifier, files),
    onSuccess: invalidate,
    meta: { errorMessage: "Failed to upload images." },
  });
}

export function useDeleteTrailImage(identifier: string) {
  const invalidate = useInvalidateTrailQueries();

  return useMutation({
    mutationKey: ["admin-trails", identifier, "delete-image"],
    mutationFn: (imageIdentifier: string) => deleteTrailImage(imageIdentifier),
    onSuccess: invalidate,
    meta: { successMessage: "Image deleted.", errorMessage: "Failed to delete image." },
  });
}
