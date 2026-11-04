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
} from "@/api/generated/admin-city-areas/admin-city-areas";
import type {
  AdminCityAreaFacilityResponse,
  AdminCityAreaResponse,
  AdminCityAreaTrailResponse,
} from "@/api/generated/model";

export const cityAreasQueryOptions = () => getAdminCityAreasGetAllSuspenseQueryOptions();

interface LinkChange<TItem> {
  area: string;
  item: TItem;
  linked: boolean;
}

function toggle<T extends { identifier: string }>(items: T[], item: T, linked: boolean): T[] {
  const rest = items.filter((existing) => existing.identifier !== item.identifier);
  return linked ? [...rest, item] : rest;
}

function useLinkMutation<TItem extends { identifier: string }>(
  request: (area: string, identifier: string, linked: boolean) => Promise<unknown>,
  apply: (area: AdminCityAreaResponse, item: TItem, linked: boolean) => AdminCityAreaResponse,
) {
  const queryClient = useQueryClient();
  const queryKey = getAdminCityAreasGetAllQueryKey();

  return useMutation({
    mutationFn: ({ area, item, linked }: LinkChange<TItem>) => request(area, item.identifier, linked),
    onMutate: async ({ area, item, linked }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<AdminCityAreaResponse[]>(queryKey);
      queryClient.setQueryData<AdminCityAreaResponse[]>(queryKey, (areas) =>
        areas?.map((current) => (current.identifier === area ? apply(current, item, linked) : current)),
      );
      return { previous };
    },
    onError: (_error, _change, result) => {
      if (result?.previous) queryClient.setQueryData(queryKey, result.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
    meta: { errorMessage: "Could not update the area." },
  });
}

export function useSetFacilityLink() {
  return useLinkMutation<AdminCityAreaFacilityResponse>(
    (area, facility, linked) =>
      linked ? adminCityAreasLinkFacility(area, facility) : adminCityAreasUnlinkFacility(area, facility),
    (area, facility, linked) => ({ ...area, facilities: toggle(area.facilities, facility, linked) }),
  );
}

export function useSetTrailLink() {
  return useLinkMutation<AdminCityAreaTrailResponse>(
    (area, trail, linked) => (linked ? adminCityAreasLinkTrail(area, trail) : adminCityAreasUnlinkTrail(area, trail)),
    (area, trail, linked) => ({ ...area, trails: toggle(area.trails, trail, linked) }),
  );
}
