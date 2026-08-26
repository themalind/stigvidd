/**
 * The rules the media upload panel decides by: what the server is told to do to the bytes,
 * which of the dropped files are kept, and which of the library's images belong to the
 * chosen target.
 *
 * Extracted from media-upload.tsx so they can be tested without driving a file picker.
 * The processing options are destructive on the server side — an image is resized, recoded
 * and cropped before it is stored, and the original is not kept.
 */

import type { ImageProcessingOptions, MediaItemResponse } from "@/types/types";

export type TargetType = "trail-gallery" | "trail-symbol" | "facility";

/** The `ownerType` the media library reports for each upload target. */
export const OWNER_TYPE: Record<TargetType, string> = {
  "trail-gallery": "Trail",
  "trail-symbol": "TrailSymbol",
  facility: "Facility",
};

export type CropRect = { x: number; y: number; width: number; height: number };

export type ProcessingChoices = {
  /** "original", "custom", or a pixel count as a string. */
  resolution: string;
  customWidth: string;
  customHeight: string;
  quality: number;
  /** "original" or an image format name. */
  format: string;
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
export function acceptImages(
  staged: File[],
  incoming: FileList | File[],
  allowMultiple: boolean,
): File[] {
  const images = Array.from(incoming).filter((file) =>
    file.type.startsWith("image/"),
  );

  if (images.length === 0) return staged;

  return allowMultiple ? [...staged, ...images] : [images[0]];
}

// Owner type as well as id: a trail's symbol carries the trail's own identifier, so
// matching on the id alone would show the symbol among the gallery images and offer a
// delete button for something that has no delete endpoint.
export function attachedTo(
  media: MediaItemResponse[],
  targetId: string,
  targetType: TargetType,
): MediaItemResponse[] {
  if (!targetId) return [];

  return media.filter(
    (item) =>
      item.ownerIdentifier === targetId &&
      item.ownerType === OWNER_TYPE[targetType],
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
