// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { appendProcessingOptions } from "./image-options";

function fieldsOf(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  );
}

describe("appendProcessingOptions", () => {
  it("names the fields the way the backend binder expects", () => {
    const formData = new FormData();

    appendProcessingOptions(formData, {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 80,
      format: "webp",
      cropX: 10,
      cropY: 20,
      cropWidth: 300,
      cropHeight: 400,
    });

    expect(fieldsOf(formData)).toEqual({
      MaxWidth: "1920",
      MaxHeight: "1080",
      Quality: "80",
      Format: "webp",
      CropX: "10",
      CropY: "20",
      CropWidth: "300",
      CropHeight: "400",
    });
  });

  it("appends nothing at all when no options are given", () => {
    const formData = new FormData();

    appendProcessingOptions(formData, undefined);

    expect([...formData.keys()]).toEqual([]);
  });

  it("omits the knobs that were left out, so the image is untouched", () => {
    const formData = new FormData();

    appendProcessingOptions(formData, { quality: 70 });

    expect([...formData.keys()]).toEqual(["Quality"]);
  });

  it("keeps a zero, which is a real crop origin, and drops the empty string", () => {
    const formData = new FormData();

    appendProcessingOptions(formData, { cropX: 0, cropY: 0, format: "" });

    expect(fieldsOf(formData)).toEqual({ CropX: "0", CropY: "0" });
  });
});
