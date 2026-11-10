// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { convertFormDataAsync } from "expo/src/winter/fetch/convertFormData";
import { imageFormPart } from "../image-form-part";

const mockBytes = jest.fn();
const mockFileUris: string[] = [];

// Shaped like expo-file-system's File: a name and type from the path, bytes read on demand.
jest.mock("expo-file-system", () => ({
  File: class {
    name: string;
    type = "image/jpeg";
    constructor(uri: string) {
      mockFileUris.push(uri);
      this.name = uri.split("/").pop() ?? "";
    }
    bytes() {
      return mockBytes();
    }
  },
}));

// Runs a part through the converter the app's global fetch uses, so the real rules apply.
function formWith(part: unknown) {
  return { entries: () => [["image", part]] } as unknown as FormData;
}

beforeEach(() => {
  mockFileUris.length = 0;
  mockBytes.mockReset().mockResolvedValue(new Uint8Array([65, 66, 67]));
});

it("becomes a jpeg part of the multipart body, with the file's bytes", async () => {
  const { body, boundary } = await convertFormDataAsync(formWith(imageFormPart("file:///cache/photo.jpg")));
  const text = new TextDecoder().decode(body);

  expect(mockFileUris).toEqual(["file:///cache/photo.jpg"]);
  expect(text).toContain(`--${boundary}\r\n`);
  expect(text).toContain('content-disposition: form-data; name="image"; filename="photo.jpg"\r\n');
  expect(text).toContain("content-type: image/jpeg\r\n\r\nABC\r\n");
});

it("leaves the file unread until the upload needs it", () => {
  imageFormPart("file:///cache/photo.jpg");

  expect(mockBytes).not.toHaveBeenCalled();
});

// The format every upload used until SDK 58: this is what broke them.
it("is needed because the fetch converter rejects React Native's uri part", async () => {
  const uriPart = { uri: "file:///photo.jpg", type: "image/jpeg", name: "photo.jpg" };

  await expect(convertFormDataAsync(formWith(uriPart))).rejects.toThrow("Unsupported FormDataPart implementation");
});

it("is the only way an api module builds a file part", () => {
  const apiDir = path.join(__dirname, "..");
  const sources = readdirSync(apiDir).filter((file) => /\.tsx?$/.test(file));
  const offenders = sources.filter((file) =>
    /\{\s*uri[,:]|new File\(/.test(readFileSync(path.join(apiDir, file), "utf8")),
  );

  expect(offenders).toEqual(["image-form-part.ts"]);
});
