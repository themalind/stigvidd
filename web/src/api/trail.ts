import type {
  ImageProcessingOptions,
  TrailImageResponse,
  TrailResponse,
  TrailShortInfoResponse,
  UpdateTrailRequest,
} from "@/types/types";
import {
  getTrailsAddTrailImagesUrl,
  getTrailsDeleteTrailImageUrl,
  getTrailsSetTrailSymbolUrl,
  trailsGetAllTrails,
  trailsGetTrailByIdentifier,
  trailsUpdateTrail,
} from "./generated/trails/trails";
import { customFetch } from "./mutator";
import { appendProcessingOptions } from "./image-options";

// These wrappers preserve the app's existing signatures/return types while
// routing every request through the orval-generated client (see orval.config.ts).
// The generated models are looser (nullable/optional) than the UI's hand-written
// types, so responses are asserted back to those types at this boundary.
// Auth + base URL are handled centrally by the `customFetch` mutator.

export async function getAllTrails(): Promise<TrailShortInfoResponse[]> {
  return (await trailsGetAllTrails()) as TrailShortInfoResponse[];
}

export async function getTrailByIdentifier({
  identifier,
}: {
  identifier: string;
}): Promise<TrailResponse> {
  return (await trailsGetTrailByIdentifier(identifier)) as TrailResponse;
}

export async function updateTrail(
  identifier: string,
  request: UpdateTrailRequest,
): Promise<TrailResponse> {
  const result = await trailsUpdateTrail(
    identifier,
    request as Parameters<typeof trailsUpdateTrail>[1],
  );
  return result as TrailResponse;
}

export async function addTrailImages(
  identifier: string,
  images: File[],
  options?: ImageProcessingOptions,
): Promise<TrailImageResponse[]> {
  // The generated multipart function can't express the `images` + option-fields
  // body shape, so build the FormData here and post through the mutator.
  const formData = new FormData();
  images.forEach((file) => formData.append("images", file));
  appendProcessingOptions(formData, options);
  return customFetch<TrailImageResponse[]>(
    getTrailsAddTrailImagesUrl(identifier),
    { method: "POST", body: formData },
  );
}

export async function setTrailSymbol(
  identifier: string,
  symbol: File,
  options?: ImageProcessingOptions,
): Promise<{ symbolUrl: string }> {
  const formData = new FormData();
  formData.append("symbol", symbol);
  appendProcessingOptions(formData, options);
  return customFetch<{ symbolUrl: string }>(
    getTrailsSetTrailSymbolUrl(identifier),
    { method: "POST", body: formData },
  );
}

export async function deleteTrailImage(imageIdentifier: string): Promise<void> {
  await customFetch<void>(getTrailsDeleteTrailImageUrl(imageIdentifier), {
    method: "DELETE",
  });
}
