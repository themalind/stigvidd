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
const mockRelease = jest.fn();

jest.mock("expo-image-manipulator", () => ({
  ImageManipulator: { manipulate: (...args: unknown[]) => mockManipulate(...args) },
  SaveFormat: { JPEG: "jpeg", PNG: "png" },
}));

const SOURCE = "file:///camera/original.heic";

// The first render is the untouched original, read for its size; the second is the result. keep-comment: mirrors resizeImage's two passes
function original(width: number, height: number) {
  const image = { width, height, release: mockRelease };
  mockManipulate.mockImplementation((source: unknown) => ({
    resize: (...args: unknown[]) => mockResize(...args),
    renderAsync: () => (source === image ? mockRender() : Promise.resolve(image)),
  }));
  return image;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockResolvedValue({ uri: "file:///cache/resized.jpg" });
  mockRender.mockResolvedValue({ saveAsync: (...args: unknown[]) => mockSave(...args) });
  original(4032, 3024);
});

describe("resizeImage", () => {
  it("returns the uri of the file it wrote, not the one it was given", async () => {
    await expect(resizeImage(SOURCE)).resolves.toBe("file:///cache/resized.jpg");
  });

  it("reads the image it was given, then works on that decoded image", async () => {
    const decoded = original(4032, 3024);
    await resizeImage(SOURCE);

    expect(mockManipulate).toHaveBeenNthCalledWith(1, SOURCE);
    expect(mockManipulate).toHaveBeenNthCalledWith(2, decoded);
  });

  // Width only: passing a height as well would stretch anything that is not 4:3.
  it("caps the width and lets the height follow the aspect ratio", async () => {
    await resizeImage(SOURCE);

    expect(mockResize).toHaveBeenCalledWith({ width: 1080 });
  });

  it("never enlarges an image that is already narrow enough", async () => {
    original(800, 600);
    await resizeImage(SOURCE);

    expect(mockResize).not.toHaveBeenCalled();
  });

  // A phone camera's original is several megabytes and the upload is over mobile data.
  it("writes a compressed JPEG whatever the source format was", async () => {
    await resizeImage(SOURCE);

    expect(mockSave).toHaveBeenCalledWith({ compress: 0.6, format: "jpeg" });
  });

  it("releases the decoded original, also when writing fails", async () => {
    await resizeImage(SOURCE);
    expect(mockRelease).toHaveBeenCalledTimes(1);

    mockSave.mockRejectedValue(new Error("disk full"));
    await expect(resizeImage(SOURCE)).rejects.toThrow("disk full");
    expect(mockRelease).toHaveBeenCalledTimes(2);
  });

  // The caller shows the user an upload error; swallowing this would upload nothing silently.
  it("propagates a failure to render", async () => {
    mockRender.mockRejectedValue(new Error("out of memory"));

    await expect(resizeImage(SOURCE)).rejects.toThrow("out of memory");
  });
});
