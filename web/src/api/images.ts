// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  getAdminFacilitiesAddFacilityImagesUrl,
  getAdminFacilitiesDeleteFacilityImageUrl,
} from "@/api/generated/admin-facilities/admin-facilities";
import {
  getAdminTrailsAddTrailImagesUrl,
  getAdminTrailsDeleteTrailImageUrl,
  getAdminTrailsSetTrailSymbolUrl,
} from "@/api/generated/admin-trails/admin-trails";
import type { TrailImageResponse, TrailSymbolResponse } from "@/api/generated/model";
import { appendProcessingOptions, type ImageProcessingOptions } from "@/api/image-options";
import { customFetch } from "@/api/mutator";

// keep-comment: the generated multipart clients expand a File's own properties into fields, so these bodies are built here
function postImages<T>(url: string, field: string, files: File[], options?: ImageProcessingOptions): Promise<T> {
  const formData = new FormData();
  files.forEach((file) => formData.append(field, file));
  appendProcessingOptions(formData, options);
  return customFetch<T>(url, { method: "POST", body: formData });
}

export function addTrailImages(
  identifier: string,
  images: File[],
  options?: ImageProcessingOptions,
): Promise<TrailImageResponse[]> {
  return postImages(getAdminTrailsAddTrailImagesUrl(identifier), "images", images, options);
}

export function setTrailSymbol(
  identifier: string,
  symbol: File,
  options?: ImageProcessingOptions,
): Promise<TrailSymbolResponse> {
  return postImages(getAdminTrailsSetTrailSymbolUrl(identifier), "symbol", [symbol], options);
}

export function addFacilityImages(
  identifier: string,
  images: File[],
  options?: ImageProcessingOptions,
): Promise<TrailImageResponse[]> {
  return postImages(getAdminFacilitiesAddFacilityImagesUrl(identifier), "images", images, options);
}

export async function deleteTrailImage(imageIdentifier: string): Promise<void> {
  await customFetch<void>(getAdminTrailsDeleteTrailImageUrl(imageIdentifier), { method: "DELETE" });
}

export async function deleteFacilityImage(imageIdentifier: string): Promise<void> {
  await customFetch<void>(getAdminFacilitiesDeleteFacilityImageUrl(imageIdentifier), { method: "DELETE" });
}
