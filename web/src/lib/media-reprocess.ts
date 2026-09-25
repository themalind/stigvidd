// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

export type ReprocessPresetKey = "optimized" | "web" | "thumbnail" | "custom";

export type ReprocessPreset = {
  key: ReprocessPresetKey;
  label: string;
  /** "original", "custom", or a pixel count as a string — matches ProcessingChoices.resolution. */
  resolution: string;
  quality: number;
  /** "original" or an image format name — matches ProcessingChoices.format. */
  format: string;
};

export const REPROCESS_PRESETS: ReprocessPreset[] = [
  { key: "optimized", label: "Optimized — 800px, quality 50, WebP", resolution: "800", quality: 50, format: "webp" },
  { key: "web", label: "Web — 1600px, quality 80, WebP", resolution: "1600", quality: 80, format: "webp" },
  { key: "thumbnail", label: "Thumbnail — 400px, quality 75, WebP", resolution: "400", quality: 75, format: "webp" },
  { key: "custom", label: "Custom", resolution: "original", quality: 82, format: "original" },
];

// keep-comment: the preset the "Needs work" filter is wired to; the chip selects exactly the images this preset would change, so the two must never be chosen independently
export const NEEDS_WORK_PRESET: ReprocessPresetKey = "optimized";

export function presetByKey(key: ReprocessPresetKey): ReprocessPreset {
  return REPROCESS_PRESETS.find((p) => p.key === key) ?? REPROCESS_PRESETS[REPROCESS_PRESETS.length - 1];
}

// keep-comment: derived from the live values rather than stored, or the label keeps naming a preset after the sliders have moved away from it
export function matchPreset(resolution: string, quality: number, format: string): ReprocessPresetKey {
  return (
    REPROCESS_PRESETS.find(
      (p) => p.key !== "custom" && p.resolution === resolution && p.quality === quality && p.format === format,
    )?.key ?? "custom"
  );
}
