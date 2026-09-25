// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  matchPreset,
  NEEDS_WORK_PRESET,
  presetByKey,
  REPROCESS_PRESETS,
} from "./media-reprocess";

describe("presetByKey", () => {
  it("finds the web preset", () => {
    expect(presetByKey("web").resolution).toBe("1600");
    expect(presetByKey("web").quality).toBe(80);
  });

  it("finds the thumbnail preset", () => {
    expect(presetByKey("thumbnail").resolution).toBe("400");
    expect(presetByKey("thumbnail").quality).toBe(75);
  });

  it("carries the 800px quality-50 WebP preset the needs-work filter is wired to", () => {
    const preset = presetByKey(NEEDS_WORK_PRESET);
    expect(preset.resolution).toBe("800");
    expect(preset.quality).toBe(50);
    expect(preset.format).toBe("webp");
  });

  it("finds the custom preset, which keeps the original resolution and format", () => {
    const preset = presetByKey("custom");
    expect(preset.resolution).toBe("original");
    expect(preset.format).toBe("original");
  });

  it("falls back to custom for a key that does not match any preset", () => {
    // TypeScript's ReprocessPresetKey rules this out statically, but a value that reached
    // here some other way (e.g. from stored state) should still resolve to something sane
    // rather than throwing or returning undefined.
    expect(presetByKey("unknown-preset" as never)).toEqual(
      REPROCESS_PRESETS[REPROCESS_PRESETS.length - 1],
    );
  });

  it("keeps custom last, which is what the fallback relies on", () => {
    expect(REPROCESS_PRESETS[REPROCESS_PRESETS.length - 1].key).toBe("custom");
  });
});

describe("matchPreset", () => {
  it("names the preset whose values are on screen", () => {
    expect(matchPreset("1600", 80, "webp")).toBe("web");
    expect(matchPreset("800", 50, "webp")).toBe("optimized");
  });

  it("stops naming a preset as soon as one value is edited away from it", () => {
    expect(matchPreset("1600", 55, "webp")).toBe("custom");
  });

  it("gives every preset a distinct set of values, or the label would be arbitrary", () => {
    const triples = REPROCESS_PRESETS.filter((p) => p.key !== "custom").map(
      (p) => `${p.resolution}|${p.quality}|${p.format}`,
    );

    expect(new Set(triples).size).toBe(triples.length);
  });
});
