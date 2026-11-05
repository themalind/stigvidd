// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminCityAreasGetAllUrl } from "@/api/generated/admin-city-areas/admin-city-areas";
import {
  adminFacilitiesUpdate,
  getAdminFacilitiesGetAllQueryKey,
  getAdminFacilitiesGetAllSuspenseQueryOptions,
} from "@/api/generated/admin-facilities/admin-facilities";
import type { SaveFacilityRequest } from "@/api/generated/model";
import { underUrl } from "@/lib/react-query";

// The admin list, as the public one drops facilities without coordinates. keep-comment: two endpoints look interchangeable
export const facilitiesQueryOptions = () => getAdminFacilitiesGetAllSuspenseQueryOptions();

export function useSaveFacility(identifier: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: SaveFacilityRequest) => adminFacilitiesUpdate(identifier, request),
    // keep-comment: areas list each facility's name and type, so they refetch too
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: getAdminFacilitiesGetAllQueryKey() }),
        queryClient.invalidateQueries(underUrl(getAdminCityAreasGetAllUrl())),
      ]),
    meta: { successMessage: "Facility saved.", errorMessage: "Could not save the facility." },
  });
}
