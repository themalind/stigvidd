// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";

const customFetch = vi.hoisted(() => vi.fn());
vi.mock("@/api/mutator", () => ({ customFetch }));

import { addFacilityImages, addTrailImages, deleteFacilityImage, deleteTrailImage, setTrailSymbol } from "./images";

function png(name: string) {
  return new File([name], name, { type: "image/png" });
}

function sentBody(): FormData {
  return customFetch.mock.calls[0][1].body as FormData;
}

beforeEach(() => {
  customFetch.mockReset();
  customFetch.mockResolvedValue([]);
});

describe("addTrailImages", () => {
  it("posts to the trail's own image route", async () => {
    await addTrailImages("abc", [png("a.png")]);

    expect(customFetch).toHaveBeenCalledWith(
      "/api/v1/admin/trails/abc/images",
      expect.objectContaining({ method: "POST" }),
    );
  });

  // The whole point of the hand-built body: the files must be on the wire as files.
  it("sends each file under `images`, not its properties as fields", async () => {
    await addTrailImages("abc", [png("a.png"), png("b.png")]);

    const images = sentBody().getAll("images");

    expect(images).toHaveLength(2);
    expect(images.every((image) => image instanceof File)).toBe(true);
    expect(images.map((image) => (image as File).name)).toEqual(["a.png", "b.png"]);
  });

  it("carries the processing knobs alongside the files", async () => {
    await addTrailImages("abc", [png("a.png")], { maxWidth: 1920, quality: 80 });

    const body = sentBody();
    expect(body.get("MaxWidth")).toBe("1920");
    expect(body.get("Quality")).toBe("80");
  });

  it("sends no knobs when none were given, so the image is untouched", async () => {
    await addTrailImages("abc", [png("a.png")]);

    expect([...sentBody().keys()]).toEqual(["images"]);
  });

  it("sets no Content-Type, so the browser can write the multipart boundary", async () => {
    await addTrailImages("abc", [png("a.png")]);

    expect(customFetch.mock.calls[0][1]).not.toHaveProperty("headers");
  });
});

describe("setTrailSymbol", () => {
  it("posts the symbol to the trail's symbol route", async () => {
    await setTrailSymbol("abc", png("symbol.png"));

    expect(customFetch).toHaveBeenCalledWith(
      "/api/v1/admin/trails/abc/symbol",
      expect.objectContaining({ method: "POST" }),
    );
    expect(sentBody().get("symbol")).toBeInstanceOf(File);
  });

  it("carries a crop, which is what the symbol editor sends", async () => {
    await setTrailSymbol("abc", png("symbol.png"), {
      cropX: 0,
      cropY: 10,
      cropWidth: 200,
      cropHeight: 200,
    });

    const body = sentBody();
    expect(body.get("CropX")).toBe("0");
    expect(body.get("CropHeight")).toBe("200");
  });
});

describe("addFacilityImages", () => {
  it("posts the files to the facility's own image route", async () => {
    await addFacilityImages("fac-1", [png("a.png")], { format: "webp" });

    expect(customFetch).toHaveBeenCalledWith(
      "/api/v1/admin/facilities/fac-1/images",
      expect.objectContaining({ method: "POST" }),
    );
    expect(sentBody().get("images")).toBeInstanceOf(File);
    expect(sentBody().get("Format")).toBe("webp");
  });
});

describe("deleting an image", () => {
  it("deletes a trail image by the image's own identifier, not the trail's", async () => {
    await deleteTrailImage("img-9");

    expect(customFetch).toHaveBeenCalledWith("/api/v1/admin/trails/images/img-9", { method: "DELETE" });
  });

  it("deletes a facility image at the facility route", async () => {
    await deleteFacilityImage("img-3");

    expect(customFetch).toHaveBeenCalledWith("/api/v1/admin/facilities/images/img-3", { method: "DELETE" });
  });
});
