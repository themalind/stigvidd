import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

const MAX_IMAGE_WIDTH = 1080; // cap width; height scales to preserve aspect ratio
const JPEG_COMPRESSION = 0.6; // 0 = smallest file, 1 = best quality

/**
 * Resizes an image to a sane width and re-compresses it to JPEG to save space.
 * Returns the uri of the new (smaller) file.
 */
export async function resizeImage(uri: string): Promise<string> {
  // Build the transform pipeline (lazy — nothing runs yet).
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: MAX_IMAGE_WIDTH });

  // Execute the resize into an in-memory image.
  const rendered = await context.renderAsync();

  // Encode + write the compressed JPEG to disk and return its uri.
  const result = await rendered.saveAsync({
    compress: JPEG_COMPRESSION,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}
