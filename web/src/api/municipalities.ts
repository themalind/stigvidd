// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminMunicipalitiesCreate,
  getAdminMunicipalitiesGetAllQueryKey,
  getAdminMunicipalitiesGetAllQueryOptions,
} from "@/api/generated/admin-municipalities/admin-municipalities";
import type { CreateMunicipalityRequest, MunicipalityResponse } from "@/api/generated/model";

export type Municipality = MunicipalityResponse;

export function useMunicipalities() {
  return useQuery({
    ...getAdminMunicipalitiesGetAllQueryOptions(),
    meta: { errorMessage: "Could not load the municipalities." },
  });
}

export function useAddMunicipality() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateMunicipalityRequest) => adminMunicipalitiesCreate(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getAdminMunicipalitiesGetAllQueryKey() }),
    meta: { successMessage: "Municipality added.", errorMessage: "Could not add the municipality." },
  });
}
