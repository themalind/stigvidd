import type { ImageProcessingOptions } from "@/types/types";

/**
 * Appends the server-side processing knobs to a multipart FormData as individual
 * form fields, matching the backend `ImageProcessingOptionsRequest` binder.
 * Only defined values are sent, so omitting a knob leaves the image untouched.
 */
export function appendProcessingOptions(
  formData: FormData,
  options?: ImageProcessingOptions,
): void {
  if (!options) return;
  const entries: [string, number | string | undefined][] = [
    ["MaxWidth", options.maxWidth],
    ["MaxHeight", options.maxHeight],
    ["Quality", options.quality],
    ["Format", options.format],
    ["CropX", options.cropX],
    ["CropY", options.cropY],
    ["CropWidth", options.cropWidth],
    ["CropHeight", options.cropHeight],
  ];
  for (const [key, value] of entries) {
    if (value !== undefined && value !== null && value !== "") {
      formData.append(key, String(value));
    }
  }
}
