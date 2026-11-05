// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AdminTrailListItemResponse, FacilityResponse, MediaItemResponse } from "@/api/generated/model";
import type { ImageProcessingOptions } from "@/api/image-options";

export type TargetType = "trail-gallery" | "trail-symbol" | "facility";

export type TrailOption = Pick<
  AdminTrailListItemResponse,
  "identifier" | "name" | "trailLength" | "city" | "classification" | "accessibility"
>;

export type FacilityOption = Pick<FacilityResponse, "identifier" | "name">;

export type OwnerList<T> = { items: T[] | undefined; failed: boolean };

/** The `ownerType` the media library reports for each upload target. */
export const OWNER_TYPE: Record<TargetType, string> = {
  "trail-gallery": "Trail",
  "trail-symbol": "TrailSymbol",
  facility: "Facility",
};

export type CropRect = { x: number; y: number; width: number; height: number };

export type ProcessingValues = {
  /** "original", "custom", or a pixel count as a string. */
  resolution: string;
  customWidth: string;
  customHeight: string;
  quality: number;
  /** "original" or an image format name. */
  format: string;
};

export type ProcessingChoices = ProcessingValues & {
  /** Only applied to a single staged file; the panel hides the cropper otherwise. */
  crop?: CropRect | null;
  canCrop?: boolean;
};

export function buildImageOptions(choices: ProcessingChoices): ImageProcessingOptions {
  const options: ImageProcessingOptions = {};

  if (choices.resolution === "custom") {
    if (choices.customWidth) options.maxWidth = Number(choices.customWidth);
    if (choices.customHeight) options.maxHeight = Number(choices.customHeight);
  } else if (choices.resolution !== "original") {
    options.maxWidth = Number(choices.resolution);
    options.maxHeight = Number(choices.resolution);
  }

  if (choices.format !== "original") options.format = choices.format;
  options.quality = choices.quality;

  if (choices.canCrop && choices.crop) {
    options.cropX = choices.crop.x;
    options.cropY = choices.crop.y;
    options.cropWidth = choices.crop.width;
    options.cropHeight = choices.crop.height;
  }

  return options;
}

/**
 * The staged set after a drop or a pick. Anything that is not an image is dropped, and a
 * target that takes one file keeps only the newest.
 */
export function acceptImages(staged: File[], incoming: FileList | File[], allowMultiple: boolean): File[] {
  const images = Array.from(incoming).filter((file) => file.type.startsWith("image/"));

  if (images.length === 0) return staged;

  return allowMultiple ? [...staged, ...images] : [images[0]];
}

// Owner type as well as id: a trail's symbol carries the trail's own identifier, so
// matching on the id alone would show the symbol among the gallery images and offer a
// delete button for something that has no delete endpoint.
export function attachedTo(media: MediaItemResponse[], targetId: string, targetType: TargetType): MediaItemResponse[] {
  if (!targetId) return [];

  return media.filter((item) => item.ownerIdentifier === targetId && item.ownerType === OWNER_TYPE[targetType]);
}
