// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { MediaItemResponse } from "@/types/types";
import {
  acceptImages,
  attachedTo,
  buildImageOptions,
  formatBytes,
  OWNER_TYPE,
} from "./media-upload";

const choices = {
  resolution: "1920",
  customWidth: "",
  customHeight: "",
  quality: 82,
  format: "webp",
};

const image = (name = "a.jpg", type = "image/jpeg") =>
  new File(["bytes"], name, { type });

/**
 * These options are what the server resizes, recodes and crops by, and the original bytes
 * are not kept. A field that goes missing here is an upload that quietly stores something
 * other than what the panel showed.
 */
describe("buildImageOptions", () => {
  it("sends the picked resolution as both bounds, so the aspect ratio is kept", () => {
    expect(buildImageOptions(choices)).toMatchObject({
      maxWidth: 1920,
      maxHeight: 1920,
    });
  });

  it("bounds nothing at all for the original resolution", () => {
    const options = buildImageOptions({ ...choices, resolution: "original" });

    expect(options).not.toHaveProperty("maxWidth");
    expect(options).not.toHaveProperty("maxHeight");
  });

  it("takes the two custom bounds separately", () => {
    expect(
      buildImageOptions({
        ...choices,
        resolution: "custom",
        customWidth: "1000",
        customHeight: "400",
      }),
    ).toMatchObject({ maxWidth: 1000, maxHeight: 400 });
  });

  // One box filled in is a bound on that side only, not a square.
  it("leaves out a custom bound that was never typed", () => {
    const options = buildImageOptions({
      ...choices,
      resolution: "custom",
      customWidth: "1000",
    });

    expect(options.maxWidth).toBe(1000);
    expect(options).not.toHaveProperty("maxHeight");
  });

  it("does not read an empty custom box as a bound of zero", () => {
    const options = buildImageOptions({ ...choices, resolution: "custom" });

    expect(options).not.toHaveProperty("maxWidth");
    expect(options).not.toHaveProperty("maxHeight");
  });

  it("names the format to recode to, and says nothing to keep the original", () => {
    expect(buildImageOptions(choices).format).toBe("webp");
    expect(
      buildImageOptions({ ...choices, format: "original" }),
    ).not.toHaveProperty("format");
  });

  it("always sends the quality, including the lowest the slider goes", () => {
    expect(buildImageOptions({ ...choices, quality: 10 }).quality).toBe(10);
    expect(buildImageOptions({ ...choices, quality: 100 }).quality).toBe(100);
  });

  const crop = { x: 10, y: 20, width: 300, height: 400 };

  it("passes the crop through when a single file is staged", () => {
    expect(buildImageOptions({ ...choices, crop, canCrop: true })).toMatchObject(
      { cropX: 10, cropY: 20, cropWidth: 300, cropHeight: 400 },
    );
  });

  // The cropper is drawn against one preview. Applying its rectangle to a batch would
  // cut every other image at coordinates picked for a picture nobody was looking at.
  it("drops a crop left over from before a second file was staged", () => {
    const options = buildImageOptions({ ...choices, crop, canCrop: false });

    expect(options).not.toHaveProperty("cropX");
    expect(options).not.toHaveProperty("cropWidth");
  });

  it("sends no crop when none was drawn", () => {
    expect(
      buildImageOptions({ ...choices, crop: null, canCrop: true }),
    ).not.toHaveProperty("cropX");
  });
});

describe("acceptImages", () => {
  it("adds to what is already staged", () => {
    const first = image("first.jpg");

    expect(acceptImages([first], [image("second.jpg")], true)).toHaveLength(2);
  });

  it("keeps only the newest file for a target that takes one", () => {
    const staged = acceptImages(
      [image("old.jpg")],
      [image("new.png", "image/png")],
      false,
    );

    expect(staged.map((f) => f.name)).toEqual(["new.png"]);
  });

  it("takes the first of several dropped on a single-file target", () => {
    const staged = acceptImages([], [image("a.jpg"), image("b.jpg")], false);

    expect(staged.map((f) => f.name)).toEqual(["a.jpg"]);
  });

  it("drops anything that is not an image", () => {
    const staged = acceptImages(
      [],
      [image("doc.pdf", "application/pdf"), image("photo.jpg")],
      true,
    );

    expect(staged.map((f) => f.name)).toEqual(["photo.jpg"]);
  });

  // A drop of nothing usable must not read as "clear what I staged".
  it("leaves the staged set alone when nothing dropped was an image", () => {
    const staged = [image("photo.jpg")];

    expect(acceptImages(staged, [image("doc.pdf", "application/pdf")], false)).toBe(
      staged,
    );
  });

  it("takes a FileList as readily as an array", () => {
    const list = {
      0: image("from-picker.jpg"),
      length: 1,
      [Symbol.iterator]: Array.prototype[Symbol.iterator],
    } as unknown as FileList;

    expect(acceptImages([], list, true).map((f) => f.name)).toEqual([
      "from-picker.jpg",
    ]);
  });
});

describe("attachedTo", () => {
  const item = (
    identifier: string,
    ownerIdentifier: string,
    ownerType: string,
  ) => ({ identifier, ownerIdentifier, ownerType }) as MediaItemResponse;

  const media = [
    item("m1", "trail-1", "Trail"),
    item("m2", "trail-1", "TrailSymbol"),
    item("m3", "trail-2", "Trail"),
    item("m4", "trail-1", "Facility"),
    // An item the server has not attached to anything. Filtering on a target id of ""
    // rather than refusing outright would put it on screen.
    item("m5", "", "Trail"),
  ];

  it("shows nothing until a target is chosen", () => {
    expect(attachedTo(media, "", "trail-gallery")).toEqual([]);
  });

  // The symbol carries the trail's own identifier, so matching on the id alone would put
  // it in the gallery — with a delete button for something that has no delete endpoint.
  it("keeps a trail's symbol out of its gallery", () => {
    expect(
      attachedTo(media, "trail-1", "trail-gallery").map((m) => m.identifier),
    ).toEqual(["m1"]);
  });

  it("shows the symbol, and only the symbol, in symbol mode", () => {
    expect(
      attachedTo(media, "trail-1", "trail-symbol").map((m) => m.identifier),
    ).toEqual(["m2"]);
  });

  it("does not mistake a facility's image for a trail's", () => {
    expect(
      attachedTo(media, "trail-1", "facility").map((m) => m.identifier),
    ).toEqual(["m4"]);
  });

  it("names an owner type for every target the panel offers", () => {
    expect(Object.values(OWNER_TYPE)).toEqual([
      "Trail",
      "TrailSymbol",
      "Facility",
    ]);
  });
});

describe("formatBytes", () => {
  it("switches unit at each threshold", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });
});
