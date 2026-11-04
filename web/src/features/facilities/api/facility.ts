// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { FacilityResponse, ImageProcessingOptions, TrailImageResponse } from "@/types/types";
import {
  adminFacilitiesGetAll,
  getAdminFacilitiesAddFacilityImagesUrl,
  getAdminFacilitiesDeleteFacilityImageUrl,
} from "@/api/generated/admin-facilities/admin-facilities";
import { customFetch } from "@/api/mutator";
import { appendProcessingOptions } from "@/api/image-options";

// The admin list, as the public one drops facilities without coordinates. keep-comment: two endpoints look interchangeable
export async function getAllFacilities(): Promise<FacilityResponse[]> {
  return (await adminFacilitiesGetAll()) as FacilityResponse[];
}

export async function uploadFacilityImages(
  identifier: string,
  images: File[],
  options?: ImageProcessingOptions,
): Promise<TrailImageResponse[]> {
  const formData = new FormData();
  images.forEach((file) => formData.append("images", file));
  appendProcessingOptions(formData, options);
  return customFetch<TrailImageResponse[]>(getAdminFacilitiesAddFacilityImagesUrl(identifier), {
    method: "POST",
    body: formData,
  });
}

export async function deleteFacilityImage(imageIdentifier: string): Promise<void> {
  await customFetch<void>(getAdminFacilitiesDeleteFacilityImageUrl(imageIdentifier), {
    method: "DELETE",
  });
}
