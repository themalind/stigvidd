// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { presetByKey, REPROCESS_PRESETS } from "./media-reprocess";

describe("presetByKey", () => {
  it("finds the web preset", () => {
    expect(presetByKey("web")).toEqual(REPROCESS_PRESETS[0]);
  });

  it("finds the thumbnail preset", () => {
    expect(presetByKey("thumbnail")).toEqual(REPROCESS_PRESETS[1]);
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
});
