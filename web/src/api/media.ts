import type { MediaItemResponse } from "@/types/types";
import { mediaGetAll, mediaUpdateMetadata } from "./generated/media/media";

// See trail.ts for the wrapper rationale — delegates to the generated client
// while keeping the app's existing signatures. Auth + base URL come from the
// `customFetch` mutator the generated functions call.

export async function getAllMedia(): Promise<MediaItemResponse[]> {
  return (await mediaGetAll()) as MediaItemResponse[];
}

export async function updateImageMetadata(
  imageIdentifier: string,
  metadata: { altText?: string | null; caption?: string | null },
): Promise<void> {
  await mediaUpdateMetadata(imageIdentifier, metadata);
}
