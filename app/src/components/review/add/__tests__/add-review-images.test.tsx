// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { snackbarAtom } from "@/atoms/snackbar-atoms";
import AddReviewImages from "@/components/review/add/add-review-images";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { resizeImage } from "@/utils/resizeImage";
import { fireEvent, screen } from "@testing-library/react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Alert, Dimensions, StyleProp, StyleSheet, ViewStyle } from "react-native";

// The picker dialog and the resizer are the platform's; the component owns what it does with their answers.
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("@/utils/resizeImage", () => ({ resizeImage: jest.fn() }));

const requestPermission = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const launchLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;
const resize = resizeImage as jest.Mock;

const { width: WIDTH } = Dimensions.get("screen");
const BUTTON_WIDTH = WIDTH * 0.25;

const setReviewImages = jest.fn();
let alert: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  requestPermission.mockResolvedValue({ granted: true });
  resize.mockImplementation(async (uri: string) => uri.replace(".jpg", "-liten.jpg"));
});

afterEach(() => {
  alert.mockRestore();
});

function show(theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme) {
  return renderWithProviders(<AddReviewImages setReviewImages={setReviewImages} />, { theme });
}

// One trip through the picker: the dialog answers with this asset.
async function pickAsset(asset: Record<string, unknown>) {
  launchLibrary.mockResolvedValueOnce({ canceled: false, assets: [asset] });
  fireEvent.press(screen.getByTestId("add-review-image-add"));
  await settle();
}

async function pick(name: string) {
  await pickAsset({ uri: `file:///dcim/${name}.jpg`, mimeType: "image/jpeg", width: 4000, height: 3000 });
}

// The button's style is a function of the press state, and it sits on the Pressable above the host view.
function buttonStyle(pressed: boolean) {
  let node = screen.getByTestId("add-review-image-add").parent;
  while (node && typeof node.props.style !== "function") {
    node = node.parent;
  }
  const style = node!.props.style as (state: { pressed: boolean }) => StyleProp<ViewStyle>;
  return StyleSheet.flatten(style({ pressed }));
}

function sources() {
  return screen.UNSAFE_getAllByType(Image).map((image) => image.props.source.uri);
}

it("starts with nothing but the button that opens the picker", () => {
  show();

  expect(screen.getByTestId("add-review-image-add")).toBeTruthy();
  expect(screen.queryAllByTestId("add-review-image")).toHaveLength(0);
  expect(screen.queryAllByTestId("add-review-image-delete")).toHaveLength(0);
});

// The upload is the shrunken copy, so it is that uri the review carries.
it("shows the shrunken copy of the picked photo, not the original", async () => {
  show();

  await pick("vandring");

  expect(resize).toHaveBeenCalledWith("file:///dcim/vandring.jpg");
  expect(sources()).toEqual(["file:///dcim/vandring-liten.jpg"]);
});

it("hands the review form the pictures it is holding", async () => {
  show();

  await pick("vandring");
  expect(setReviewImages).toHaveBeenLastCalledWith(["file:///dcim/vandring-liten.jpg"]);

  await pick("utsikt");
  expect(setReviewImages).toHaveBeenLastCalledWith([
    "file:///dcim/vandring-liten.jpg",
    "file:///dcim/utsikt-liten.jpg",
  ]);
});

// Cropping is off: the component resizes and re-compresses the picked file itself.
it("asks the library for photos, uncropped", async () => {
  show();

  await pick("vandring");

  expect(launchLibrary).toHaveBeenCalledWith({ mediaTypes: ["images"], allowsEditing: false });
});

it("keeps the pictures in the order they were picked", async () => {
  show();

  await pick("ett");
  await pick("tva");
  await pick("tre");

  expect(sources()).toEqual(["file:///dcim/ett-liten.jpg", "file:///dcim/tva-liten.jpg", "file:///dcim/tre-liten.jpg"]);
});

it("works on its own, without a form to report to", async () => {
  renderWithProviders(<AddReviewImages />);

  await pick("vandring");

  expect(sources()).toEqual(["file:///dcim/vandring-liten.jpg"]);
});

it("asks for the library before opening it, and gives up when it is refused", async () => {
  requestPermission.mockResolvedValue({ granted: false });
  show();

  fireEvent.press(screen.getByTestId("add-review-image-add"));
  await settle();

  expect(alert).toHaveBeenCalledWith("Tillgång krävs", "Tillgång till mediabiblioteket krävs.");
  expect(launchLibrary).not.toHaveBeenCalled();
  expect(screen.queryAllByTestId("add-review-image")).toHaveLength(0);
});

it("does nothing when the picker is closed without a picture", async () => {
  const { store } = show();
  launchLibrary.mockResolvedValueOnce({ canceled: true, assets: null });

  fireEvent.press(screen.getByTestId("add-review-image-add"));
  await settle();

  expect(resize).not.toHaveBeenCalled();
  expect(screen.queryAllByTestId("add-review-image")).toHaveLength(0);
  expect(setReviewImages).not.toHaveBeenCalled();
  // Closing the picker is not a failure, and raises no error the user never caused.
  expect(store.get(snackbarAtom).visible).toBe(false);
});

// The API takes JPEG only, so a PNG has to be turned away here rather than at upload.
it("turns away a picture that is not a JPEG", async () => {
  const { store } = show();

  await pickAsset({ uri: "file:///dcim/skarmdump.png", mimeType: "image/png" });

  expect(store.get(snackbarAtom)).toMatchObject({
    visible: true,
    type: "error",
    message: "Endast JPG-bilder är tillåtna",
  });
  expect(resize).not.toHaveBeenCalled();
  expect(screen.queryAllByTestId("add-review-image")).toHaveLength(0);
  expect(setReviewImages).not.toHaveBeenCalled();
});

it("turns away a picture the library cannot name a type for", async () => {
  const { store } = show();

  await pickAsset({ uri: "file:///dcim/okand.jpg" });

  expect(store.get(snackbarAtom)).toMatchObject({ visible: true, message: "Endast JPG-bilder är tillåtna" });
  expect(screen.queryAllByTestId("add-review-image")).toHaveLength(0);
});

it("says so when the picture cannot be shrunk, and keeps the ones already picked", async () => {
  const { store } = show();
  await pick("vandring");
  resize.mockRejectedValueOnce(new Error("out of disk"));

  await pick("utsikt");

  expect(store.get(snackbarAtom)).toMatchObject({
    visible: true,
    type: "error",
    message: "Kunde inte spara bilder",
  });
  expect(sources()).toEqual(["file:///dcim/vandring-liten.jpg"]);
});

it("says so when the picker itself fails", async () => {
  const { store } = show();
  launchLibrary.mockRejectedValueOnce(new Error("no library"));

  fireEvent.press(screen.getByTestId("add-review-image-add"));
  await settle();

  expect(store.get(snackbarAtom)).toMatchObject({ visible: true, message: "Kunde inte spara bilder" });
  expect(screen.queryAllByTestId("add-review-image")).toHaveLength(0);
});

it("removes the picture whose cross is pressed, and only that one", async () => {
  show();
  await pick("ett");
  await pick("tva");
  await pick("tre");

  fireEvent.press(screen.getAllByTestId("add-review-image-delete")[1]);
  await settle();

  expect(sources()).toEqual(["file:///dcim/ett-liten.jpg", "file:///dcim/tre-liten.jpg"]);
  expect(setReviewImages).toHaveBeenLastCalledWith(["file:///dcim/ett-liten.jpg", "file:///dcim/tre-liten.jpg"]);
});

it("gives every picture a cross of its own", async () => {
  show();
  await pick("ett");
  await pick("tva");

  expect(screen.getAllByTestId("add-review-image")).toHaveLength(2);
  expect(screen.getAllByTestId("add-review-image-delete")).toHaveLength(2);
});

// Three is the limit a review carries, so the button is taken away rather than failing on the fourth.
it("stops offering the picker at three pictures", async () => {
  show();
  await pick("ett");
  await pick("tva");
  expect(screen.getByTestId("add-review-image-add")).toBeTruthy();

  await pick("tre");

  expect(screen.queryByTestId("add-review-image-add")).toBeNull();
  expect(screen.getAllByTestId("add-review-image")).toHaveLength(3);
});

it("offers the picker again once a picture is removed", async () => {
  show();
  await pick("ett");
  await pick("tva");
  await pick("tre");

  fireEvent.press(screen.getAllByTestId("add-review-image-delete")[0]);
  await settle();

  expect(screen.getByTestId("add-review-image-add")).toBeTruthy();
});

it("lays the pictures out in a row that wraps", () => {
  show();

  expect(screen.getByTestId("add-review-images")).toHaveStyle({
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  });
});

// The thumbnails are portrait and a quarter of the screen wide, so three and the button share the row.
it("shows each thumbnail as a quarter-width portrait, cropped to fill", async () => {
  show();
  await pick("vandring");

  const image = screen.UNSAFE_getAllByType(Image)[0];
  expect(image.props.contentFit).toBe("cover");
  expect(image.props.style).toMatchObject({ width: BUTTON_WIDTH, aspectRatio: 3 / 4 });
});

it("gives the picker button the same footprint as a thumbnail", () => {
  show();

  expect(screen.getByTestId("add-review-image-add")).toHaveStyle({
    width: BUTTON_WIDTH,
    aspectRatio: 3 / 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    backgroundColor: AppDefaultTheme.colors.surface,
    borderColor: AppDefaultTheme.colors.primary,
  });
});

it("dims the picker button while it is held down", () => {
  show();

  expect(buttonStyle(false).opacity).toBeUndefined();
  expect(buttonStyle(true).opacity).toBe(0.7);
});

it("draws the plus in the theme's primary", () => {
  show();

  const plus = screen.getByTestId("icon-file-image-plus-outline");
  expect(plus.props.size).toBe(40);
  expect(plus.props.color).toBe(AppDefaultTheme.colors.primary);
});

// The cross sits over the thumbnail's top corner, on the background colour so it stays readable.
it("puts the cross in the thumbnail's top corner, above the picture", async () => {
  show();
  await pick("vandring");

  expect(screen.getByTestId("add-review-image-delete")).toHaveStyle({
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 1337,
    borderRadius: 50,
    backgroundColor: AppDefaultTheme.colors.background,
  });
});

it("draws the cross large enough to hit", async () => {
  show();
  await pick("vandring");

  const cross = screen.getByTestId("icon-close");
  expect(cross.props.size).toBe(25);
  expect(cross.props.color).toBe(AppDefaultTheme.colors.onBackground);
});

it("carries the dark theme's colours too", async () => {
  show(AppDarkTheme);
  await pick("vandring");

  expect(screen.getByTestId("add-review-image-delete")).toHaveStyle({
    backgroundColor: AppDarkTheme.colors.background,
  });
  expect(screen.getByTestId("icon-close").props.color).toBe(AppDarkTheme.colors.onBackground);
  expect(screen.getByTestId("icon-file-image-plus-outline").props.color).toBe(AppDarkTheme.colors.primary);
});
