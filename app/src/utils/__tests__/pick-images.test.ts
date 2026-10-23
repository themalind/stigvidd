// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import "@/i18n";
import { pickImages } from "@/utils/pick-images";
import { resizeImage } from "@/utils/resizeImage";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("@/utils/resizeImage", () => ({ resizeImage: jest.fn() }));

const requestPermission = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const launchLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;
const resize = resizeImage as jest.Mock;
let alert: jest.SpyInstance;

function picked(...names: string[]) {
  return { canceled: false, assets: names.map((name) => ({ uri: `file:///dcim/${name}.heic` })) };
}

beforeEach(() => {
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  requestPermission.mockResolvedValue({ granted: true });
  resize.mockImplementation(async (uri: string) => uri.replace(".heic", ".jpg"));
});

afterEach(() => {
  alert.mockRestore();
});

it("explains and opens nothing when library access is denied", async () => {
  requestPermission.mockResolvedValue({ granted: false });

  await expect(pickImages({ limit: 3 })).resolves.toBeNull();

  expect(alert).toHaveBeenCalledWith("Tillgång krävs", "Tillgång till mediabiblioteket krävs.");
  expect(launchLibrary).not.toHaveBeenCalled();
});

it("returns nothing when the picker is cancelled", async () => {
  launchLibrary.mockResolvedValue({ canceled: true, assets: null });

  await expect(pickImages({ limit: 3 })).resolves.toBeNull();
  expect(resize).not.toHaveBeenCalled();
});

it("lets several be picked, up to the limit", async () => {
  launchLibrary.mockResolvedValue(picked("a"));

  await pickImages({ limit: 4 });

  expect(launchLibrary).toHaveBeenCalledWith({
    mediaTypes: ["images"],
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: 4,
  });
});

it("asks for a single image when only one fits", async () => {
  launchLibrary.mockResolvedValue(picked("a"));

  await pickImages({ limit: 1 });

  expect(launchLibrary).toHaveBeenCalledWith({ mediaTypes: ["images"], allowsEditing: false });
});

it("returns every picked image converted to JPEG, in the order picked", async () => {
  launchLibrary.mockResolvedValue(picked("a", "b"));

  await expect(pickImages({ limit: 5 })).resolves.toEqual(["file:///dcim/a.jpg", "file:///dcim/b.jpg"]);
});

it("drops anything the picker returns past the limit", async () => {
  launchLibrary.mockResolvedValue(picked("a", "b", "c"));

  await expect(pickImages({ limit: 2 })).resolves.toEqual(["file:///dcim/a.jpg", "file:///dcim/b.jpg"]);
  expect(resize).toHaveBeenCalledTimes(2);
});

it("lets a failed conversion reach the caller", async () => {
  launchLibrary.mockResolvedValue(picked("a"));
  resize.mockRejectedValue(new Error("decode"));

  await expect(pickImages({ limit: 1 })).rejects.toThrow("decode");
});
