// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminCityAreasLinkFacility,
  adminCityAreasLinkTrail,
  adminCityAreasPreviewBoundary,
  adminCityAreasRecalculateAll,
  adminCityAreasRemoveBoundary,
  adminCityAreasRemoveFacilityExclusion,
  adminCityAreasRemoveTrailExclusion,
  adminCityAreasSaveBoundary,
  adminCityAreasSetMunicipality,
  adminCityAreasSuggestBoundary,
  adminCityAreasUnlinkFacility,
  adminCityAreasUnlinkTrail,
  getAdminCityAreasGetAllQueryKey,
  getAdminCityAreasGetAllSuspenseQueryOptions,
  getAdminCityAreasGetAllUrl,
  getAdminCityAreasGetTrailPathsQueryOptions,
  getAdminCityAreasGetLinkSuggestionsQueryKey,
  getAdminCityAreasGetLinkSuggestionsSuspenseQueryOptions,
} from "@/api/generated/admin-city-areas/admin-city-areas";
import type {
  AdminCityAreaFacilityResponse,
  AdminCityAreaResponse,
  AdminCityAreaTrailResponse,
  AdminLinkSuggestionsResponse,
} from "@/api/generated/model";
import { underUrl } from "@/lib/react-query";

interface LinkChange<TItem> {
  areas: string[];
  item: TItem;
  linked: boolean;
}

export type LinkKind = "facilities" | "trails";

const SET_LINK = ["admin-city-areas", "set-link"];

export const cityAreasQueryOptions = () => getAdminCityAreasGetAllSuspenseQueryOptions();

export const linkSuggestionsQueryOptions = () => getAdminCityAreasGetLinkSuggestionsSuspenseQueryOptions();

export const trailPathsQueryOptions = (area: string) => getAdminCityAreasGetTrailPathsQueryOptions(area);

export type BoundaryCoordinates = number[][][][];

function useInvalidateAreas() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries(underUrl(getAdminCityAreasGetAllUrl()));
}

export function useSuggestBoundary() {
  return useMutation({
    mutationFn: async (area: string): Promise<BoundaryCoordinates> =>
      (await adminCityAreasSuggestBoundary(area)).coordinates,
  });
}

// keep-comment: a mutation because the draft travels in a POST body; only the latest call's result is kept
export function usePreviewBoundary() {
  return useMutation({
    mutationFn: ({ area, coordinates }: { area: string; coordinates: BoundaryCoordinates }) =>
      adminCityAreasPreviewBoundary(area, { coordinates }),
  });
}

export function useSaveBoundary() {
  const invalidate = useInvalidateAreas();
  return useMutation({
    mutationFn: ({ area, coordinates }: { area: string; coordinates: BoundaryCoordinates }) =>
      adminCityAreasSaveBoundary(area, { coordinates }),
    onSuccess: invalidate,
    meta: { successMessage: "Boundary saved. The area's links were recalculated." },
  });
}

export function useRemoveBoundary() {
  const invalidate = useInvalidateAreas();
  return useMutation({
    mutationFn: (area: string) => adminCityAreasRemoveBoundary(area),
    onSuccess: invalidate,
    meta: { successMessage: "Boundary removed.", errorMessage: "Could not remove the boundary." },
  });
}

export function useSetMunicipality() {
  const invalidate = useInvalidateAreas();
  return useMutation({
    mutationFn: ({ area, municipality }: { area: string; municipality: string | null }) =>
      adminCityAreasSetMunicipality(area, { municipalityIdentifier: municipality }),
    onSuccess: invalidate,
    meta: { successMessage: "Municipality saved.", errorMessage: "Could not save the municipality." },
  });
}

export function useRecalculateAll() {
  const invalidate = useInvalidateAreas();
  return useMutation({
    mutationFn: () => adminCityAreasRecalculateAll(),
    onSuccess: invalidate,
    meta: {
      successMessage: "Every area with a boundary was recalculated.",
      errorMessage: "Could not recalculate the areas.",
    },
  });
}

export function useRemoveExclusion() {
  const invalidate = useInvalidateAreas();
  return useMutation({
    mutationFn: ({ area, kind, identifier }: { area: string; kind: LinkKind; identifier: string }) =>
      kind === "facilities"
        ? adminCityAreasRemoveFacilityExclusion(area, identifier)
        : adminCityAreasRemoveTrailExclusion(area, identifier),
    onSuccess: invalidate,
    meta: { errorMessage: "Could not undo the exclusion." },
  });
}

function toggle<T extends { identifier: string }>(items: T[], item: T, linked: boolean): T[] {
  const rest = items.filter((existing) => existing.identifier !== item.identifier);
  return linked ? [...rest, item] : rest;
}

function withoutUnlinked(
  suggestions: AdminLinkSuggestionsResponse,
  kind: LinkKind,
  identifier: string,
): AdminLinkSuggestionsResponse {
  return kind === "facilities"
    ? { ...suggestions, facilities: suggestions.facilities.filter((f) => f.identifier !== identifier) }
    : { ...suggestions, trails: suggestions.trails.filter((t) => t.identifier !== identifier) };
}

function useLinkMutation<TItem extends { identifier: string }>(
  kind: LinkKind,
  request: (area: string, identifier: string, linked: boolean) => Promise<unknown>,
  apply: (area: AdminCityAreaResponse, item: TItem, linked: boolean) => AdminCityAreaResponse,
) {
  const queryClient = useQueryClient();
  const areasKey = getAdminCityAreasGetAllQueryKey();
  const suggestionsKey = getAdminCityAreasGetLinkSuggestionsQueryKey();

  return useMutation({
    mutationKey: SET_LINK,
    mutationFn: ({ areas, item, linked }: LinkChange<TItem>) =>
      Promise.all(areas.map((area) => request(area, item.identifier, linked))),
    onMutate: async ({ areas: changed, item, linked }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: areasKey }),
        queryClient.cancelQueries({ queryKey: suggestionsKey }),
      ]);
      const previousAreas = queryClient.getQueryData<AdminCityAreaResponse[]>(areasKey);
      const previousSuggestions = queryClient.getQueryData<AdminLinkSuggestionsResponse>(suggestionsKey);
      queryClient.setQueryData<AdminCityAreaResponse[]>(areasKey, (areas) =>
        areas?.map((current) => (changed.includes(current.identifier) ? apply(current, item, linked) : current)),
      );
      if (linked) {
        queryClient.setQueryData<AdminLinkSuggestionsResponse>(
          suggestionsKey,
          (suggestions) => suggestions && withoutUnlinked(suggestions, kind, item.identifier),
        );
      }
      return { previousAreas, previousSuggestions };
    },
    onError: (_error, _change, result) => {
      if (result?.previousAreas) queryClient.setQueryData(areasKey, result.previousAreas);
      if (result?.previousSuggestions) queryClient.setQueryData(suggestionsKey, result.previousSuggestions);
    },
    // keep-comment: refetching while another link is in flight would bring that row back until it settles
    onSettled: () =>
      queryClient.isMutating({ mutationKey: SET_LINK }) === 1
        ? Promise.all([
            queryClient.invalidateQueries({ queryKey: areasKey }),
            queryClient.invalidateQueries({ queryKey: suggestionsKey }),
          ])
        : undefined,
    meta: { errorMessage: "Could not update the area." },
  });
}

// keep-comment: a link made here is always manual; the refetch afterwards brings the server's view
export function useSetFacilityLink() {
  return useLinkMutation<Omit<AdminCityAreaFacilityResponse, "isManual">>(
    "facilities",
    (area, facility, linked) =>
      linked ? adminCityAreasLinkFacility(area, facility) : adminCityAreasUnlinkFacility(area, facility),
    (area, { identifier, name, facilityType }, linked) => ({
      ...area,
      facilities: toggle(area.facilities, { identifier, name, facilityType, isManual: true }, linked),
    }),
  );
}

export function useSetTrailLink() {
  return useLinkMutation<Omit<AdminCityAreaTrailResponse, "isManual">>(
    "trails",
    (area, trail, linked) => (linked ? adminCityAreasLinkTrail(area, trail) : adminCityAreasUnlinkTrail(area, trail)),
    (area, { identifier, name, isVerified }, linked) => ({
      ...area,
      trails: toggle(area.trails, { identifier, name, isVerified, isManual: true }, linked),
    }),
  );
}
