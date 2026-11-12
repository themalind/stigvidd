// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminCityAreasGetAllUrl } from "@/api/generated/admin-city-areas/admin-city-areas";
import { getAdminFacilitiesGetAllQueryKey } from "@/api/generated/admin-facilities/admin-facilities";
import {
  adminFacilityImportApply,
  adminFacilityImportPreview,
} from "@/api/generated/admin-facility-import/admin-facility-import";
import { getAdminFacilityImportSourcesGetAllQueryKey } from "@/api/generated/admin-facility-import-sources/admin-facility-import-sources";
import type {
  FacilityImportApplyResponse,
  FacilityImportKeepRequest,
  FacilityImportLinkRequest,
  FacilityImportMappingRequest,
  FacilityImportPreviewResponse,
  FacilityImportRequest,
  FacilityImportRowResponse,
} from "@/api/generated/model";
import { underUrl } from "@/lib/react-query";

export type ImportRequest = FacilityImportRequest;
export type Preview = FacilityImportPreviewResponse;
export type ImportRow = FacilityImportRowResponse;
export type ApplyResult = FacilityImportApplyResponse;

export interface SourceFile {
  sourceIdentifier: string;
  geoJson: string;
  mapping: FacilityImportMappingRequest;
}

// keep-comment: the admin's decisions on a preview, sent with the file so the next plan matches what was shown
export interface Choices {
  links: FacilityImportLinkRequest[];
  kept: FacilityImportKeepRequest[];
}

// keep-comment: a POST because the file travels in the body; it writes nothing. No errorMessage: the server's own reason is the toast
export function usePreviewImport() {
  return useMutation({
    mutationFn: (request: ImportRequest) => adminFacilityImportPreview(request),
  });
}

export function useApplyImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ImportRequest) => adminFacilityImportApply(request),
    // keep-comment: areas list their facilities, and the source now remembers the mapping
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: getAdminFacilitiesGetAllQueryKey() }),
        queryClient.invalidateQueries(underUrl(getAdminCityAreasGetAllUrl())),
        queryClient.invalidateQueries({ queryKey: getAdminFacilityImportSourcesGetAllQueryKey() }),
      ]),
    // keep-comment: no errorMessage, so a 409 or 400 shows the server's own reason
    meta: { successMessage: "Import applied." },
  });
}
