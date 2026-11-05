// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminCityAreasLinkFacility,
  adminCityAreasLinkTrail,
  adminCityAreasUnlinkFacility,
  adminCityAreasUnlinkTrail,
  getAdminCityAreasGetAllQueryKey,
  getAdminCityAreasGetAllSuspenseQueryOptions,
  getAdminCityAreasGetLinkSuggestionsQueryKey,
  getAdminCityAreasGetLinkSuggestionsSuspenseQueryOptions,
} from "@/api/generated/admin-city-areas/admin-city-areas";
import type {
  AdminCityAreaFacilityResponse,
  AdminCityAreaResponse,
  AdminCityAreaTrailResponse,
  AdminLinkSuggestionsResponse,
} from "@/api/generated/model";

interface LinkChange<TItem> {
  areas: string[];
  item: TItem;
  linked: boolean;
}

type LinkKind = "facilities" | "trails";

const SET_LINK = ["admin-city-areas", "set-link"];

export const cityAreasQueryOptions = () => getAdminCityAreasGetAllSuspenseQueryOptions();

export const linkSuggestionsQueryOptions = () => getAdminCityAreasGetLinkSuggestionsSuspenseQueryOptions();

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

export function useSetFacilityLink() {
  return useLinkMutation<AdminCityAreaFacilityResponse>(
    "facilities",
    (area, facility, linked) =>
      linked ? adminCityAreasLinkFacility(area, facility) : adminCityAreasUnlinkFacility(area, facility),
    (area, { identifier, name, facilityType }, linked) => ({
      ...area,
      facilities: toggle(area.facilities, { identifier, name, facilityType }, linked),
    }),
  );
}

export function useSetTrailLink() {
  return useLinkMutation<AdminCityAreaTrailResponse>(
    "trails",
    (area, trail, linked) => (linked ? adminCityAreasLinkTrail(area, trail) : adminCityAreasUnlinkTrail(area, trail)),
    (area, { identifier, name, isVerified }, linked) => ({
      ...area,
      trails: toggle(area.trails, { identifier, name, isVerified }, linked),
    }),
  );
}
