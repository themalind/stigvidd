// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  FacilityResponse,
  ImageProcessingOptions,
  TrailImageResponse,
} from "@/types/types";
import { getFacilitiesGetAllUrl } from "./generated/facilities/facilities";
// Facility image management is admin-only and lives under api/v1/admin/facilities.
import {
  getAdminFacilitiesAddFacilityImagesUrl,
  getAdminFacilitiesDeleteFacilityImageUrl,
} from "./generated/admin-facilities/admin-facilities";
import { customFetch } from "./mutator";
import { appendProcessingOptions } from "./image-options";

// See trail.ts for the wrapper rationale. The generated facility GET/DELETE
// functions are typed `Blob` (the backend didn't annotate those responses), so
// they go through the URL builder + `customFetch` mutator with the real types.

export async function getAllFacilities(): Promise<FacilityResponse[]> {
  return customFetch<FacilityResponse[]>(getFacilitiesGetAllUrl(), {
    method: "GET",
  });
}

export async function uploadFacilityImages(
  identifier: string,
  images: File[],
  options?: ImageProcessingOptions,
): Promise<TrailImageResponse[]> {
  const formData = new FormData();
  images.forEach((file) => formData.append("images", file));
  appendProcessingOptions(formData, options);
  return customFetch<TrailImageResponse[]>(
    getAdminFacilitiesAddFacilityImagesUrl(identifier),
    { method: "POST", body: formData },
  );
}

export async function deleteFacilityImage(
  imageIdentifier: string,
): Promise<void> {
  await customFetch<void>(getAdminFacilitiesDeleteFacilityImageUrl(imageIdentifier), {
    method: "DELETE",
  });
}
