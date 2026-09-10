// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { resizeImage } from "@/utils/resizeImage";

const mockManipulate = jest.fn();
const mockResize = jest.fn();
const mockRender = jest.fn();
const mockSave = jest.fn();

jest.mock("expo-image-manipulator", () => ({
  ImageManipulator: { manipulate: (...args: unknown[]) => mockManipulate(...args) },
  SaveFormat: { JPEG: "jpeg", PNG: "png" },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockResolvedValue({ uri: "file:///cache/resized.jpg" });
  mockRender.mockResolvedValue({ saveAsync: (...args: unknown[]) => mockSave(...args) });
  mockManipulate.mockReturnValue({
    resize: (...args: unknown[]) => mockResize(...args),
    renderAsync: (...args: unknown[]) => mockRender(...args),
  });
});

describe("resizeImage", () => {
  it("returns the uri of the file it wrote, not the one it was given", async () => {
    await expect(resizeImage("file:///camera/original.heic")).resolves.toBe("file:///cache/resized.jpg");
  });

  it("works on the image it was given", async () => {
    await resizeImage("file:///camera/original.heic");

    expect(mockManipulate).toHaveBeenCalledWith("file:///camera/original.heic");
  });

  // Width only: passing a height as well would stretch anything that is not 4:3.
  it("caps the width and lets the height follow the aspect ratio", async () => {
    await resizeImage("file:///camera/original.heic");

    expect(mockResize).toHaveBeenCalledWith({ width: 1080 });
  });

  // A phone camera's original is several megabytes and the upload is over mobile data.
  it("writes a compressed JPEG whatever the source format was", async () => {
    await resizeImage("file:///camera/original.heic");

    expect(mockSave).toHaveBeenCalledWith({ compress: 0.6, format: "jpeg" });
  });

  it("resizes before rendering", async () => {
    const order: string[] = [];
    mockResize.mockImplementation(() => order.push("resize"));
    mockRender.mockImplementation(() => {
      order.push("render");
      return Promise.resolve({ saveAsync: mockSave });
    });

    await resizeImage("file:///camera/original.heic");

    expect(order).toEqual(["resize", "render"]);
  });

  // The caller shows the user an upload error; swallowing this would upload nothing silently.
  it("propagates a failure to render", async () => {
    mockRender.mockRejectedValue(new Error("out of memory"));

    await expect(resizeImage("file:///camera/original.heic")).rejects.toThrow("out of memory");
  });

  it("propagates a failure to write the file", async () => {
    mockSave.mockRejectedValue(new Error("disk full"));

    await expect(resizeImage("file:///camera/original.heic")).rejects.toThrow("disk full");
  });
});
