// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";

// These three go through customFetch directly rather than the generated client: the
// generated multipart functions expand a file's own properties into form fields instead
// of sending the file, so the body is built by hand. That workaround is what is asserted.
const customFetch = vi.hoisted(() => vi.fn());
vi.mock("./mutator", () => ({ customFetch }));

const generated = vi.hoisted(() => ({
  trailsGetAllTrails: vi.fn(),
  trailsGetTrailByIdentifier: vi.fn(),
}));
vi.mock("./generated/trails/trails", () => generated);

// Editing a trail is admin-only, so these four moved to api/v1/admin/trails and are
// generated into their own module. Mocking only the public one would leave the real
// admin module in play and the URL assertions below would silently test nothing.
const generatedAdmin = vi.hoisted(() => ({
  adminTrailsUpdateTrail: vi.fn(),
  getAdminTrailsAddTrailImagesUrl: vi.fn(
    (id: string) => `/api/v1/admin/trails/${id}/images`,
  ),
  getAdminTrailsDeleteTrailImageUrl: vi.fn(
    (id: string) => `/api/v1/admin/trails/images/${id}`,
  ),
  getAdminTrailsSetTrailSymbolUrl: vi.fn(
    (id: string) => `/api/v1/admin/trails/${id}/symbol`,
  ),
}));
vi.mock("./generated/admin-trails/admin-trails", () => generatedAdmin);

import {
  addTrailImages,
  deleteTrailImage,
  getAllTrails,
  setTrailSymbol,
} from "./trail";

function png(name: string) {
  return new File([name], name, { type: "image/png" });
}

function sentBody(): FormData {
  return customFetch.mock.calls[0][1].body as FormData;
}

beforeEach(() => {
  customFetch.mockResolvedValue([]);
});

describe("getAllTrails", () => {
  it("goes through the generated client", async () => {
    generated.trailsGetAllTrails.mockResolvedValue([{ identifier: "abc" }]);

    await expect(getAllTrails()).resolves.toEqual([{ identifier: "abc" }]);
  });
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

describe("deleteTrailImage", () => {
  it("deletes by the image's own identifier, not the trail's", async () => {
    customFetch.mockResolvedValue(undefined);

    await deleteTrailImage("img-9");

    expect(customFetch).toHaveBeenCalledWith("/api/v1/admin/trails/images/img-9", {
      method: "DELETE",
    });
  });
});
