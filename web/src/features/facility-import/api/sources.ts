// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminFacilityImportSourcesCreate,
  getAdminFacilityImportSourcesGetAllQueryKey,
  getAdminFacilityImportSourcesGetAllQueryOptions,
} from "@/api/generated/admin-facility-import-sources/admin-facility-import-sources";
import type { CreateFacilityImportSourceRequest, FacilityImportSourceResponse } from "@/api/generated/model";

export type ImportSource = FacilityImportSourceResponse;

export function useImportSources() {
  return useQuery({
    ...getAdminFacilityImportSourcesGetAllQueryOptions(),
    meta: { errorMessage: "Could not load the data sources." },
  });
}

export function useAddImportSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateFacilityImportSourceRequest) => adminFacilityImportSourcesCreate(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getAdminFacilityImportSourcesGetAllQueryKey() }),
    meta: { successMessage: "Data source added.", errorMessage: "Could not add the data source." },
  });
}
