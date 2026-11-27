// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { snackbarAtom } from "@/atoms/snackbar-atoms";
import AddReviewImages, { ReviewFormImage } from "@/components/review/add/add-review-images";
import { getAllByType } from "@/test/composites";
import { settle } from "@/test/flush";
import { getDialog, hideDialog } from "@/services/dialog";
import { defined } from "@/test/defined";
import { renderWithProviders } from "@/test/render";
import { resizeImage } from "@/utils/image/resize-image";
import { fireEvent, screen } from "@testing-library/react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";

// keep-comment: the picker dialog and the resizer are the platform's; the component owns what it does with their answers
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("@/utils/image/resize-image", () => ({ resizeImage: jest.fn() }));

const requestPermission = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const launchLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;
const resize = resizeImage as jest.Mock;

const onChange = jest.fn();

// keep-comment: the component is controlled, so the test plays the form that holds the list
function Form({ initial = [] }: { initial?: ReviewFormImage[] }) {
  const [images, setImages] = useState(initial);
  return (
    <AddReviewImages
      images={images}
      onChange={(next) => {
        onChange(next);
        setImages(next);
      }}
    />
  );
}

function picked(uri: string) {
  return expect.objectContaining({ kind: "new", uri });
}

beforeEach(() => {
  jest.clearAllMocks();
  requestPermission.mockResolvedValue({ granted: true });
  resize.mockImplementation(async (uri: string) => uri.replace(".jpg", "-liten.jpg"));
});

afterEach(() => {
  hideDialog();
});

function show() {
  return renderWithProviders(<Form />);
}

function addButton() {
  return screen.queryByTestId("image-strip-add") ?? screen.getByTestId("image-strip-empty");
}

async function pickAssets(assets: Record<string, unknown>[]) {
  launchLibrary.mockResolvedValueOnce({ canceled: false, assets });
  await fireEvent.press(addButton());
  await settle();
}

async function pick(name: string) {
  await pickAssets([{ uri: `file:///dcim/${name}.jpg`, mimeType: "image/jpeg", width: 4000, height: 3000 }]);
}

function sources() {
  return getAllByType(Image).map((image) => image.props.source.uri);
}

async function remove(index: number) {
  await fireEvent.press(defined(screen.getAllByTestId("image-strip-remove")[index], `cross ${index}`));
  await settle();
}

it("starts with only the invitation to add photos", async () => {
  await show();

  expect(screen.getByTestId("image-strip-empty")).toBeTruthy();
  expect(screen.getByText("Upp till 3 bilder")).toBeTruthy();
  expect(screen.queryAllByTestId("image-strip-item")).toHaveLength(0);
});

it("shows the shrunken copy of the picked photo, not the original", async () => {
  await show();

  await pick("vandring");

  expect(resize).toHaveBeenCalledWith("file:///dcim/vandring.jpg");
  expect(sources()).toEqual(["file:///dcim/vandring-liten.jpg"]);
});

it("hands the review form the pictures it is holding", async () => {
  await show();

  await pick("vandring");
  expect(onChange).toHaveBeenLastCalledWith([picked("file:///dcim/vandring-liten.jpg")]);

  await pick("utsikt");
  expect(onChange).toHaveBeenLastCalledWith([
    picked("file:///dcim/vandring-liten.jpg"),
    picked("file:///dcim/utsikt-liten.jpg"),
  ]);
});

it("lets the library pick as many uncropped photos as still fit", async () => {
  await show();
  await pick("ett");

  await pick("tva");

  expect(launchLibrary).toHaveBeenNthCalledWith(1, {
    mediaTypes: ["images"],
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: 3,
  });
  expect(launchLibrary).toHaveBeenLastCalledWith({
    mediaTypes: ["images"],
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: 2,
  });
});

it("takes several photos in one pick", async () => {
  await show();

  await pickAssets([{ uri: "file:///dcim/ett.jpg" }, { uri: "file:///dcim/tva.jpg" }]);

  expect(sources()).toEqual(["file:///dcim/ett-liten.jpg", "file:///dcim/tva-liten.jpg"]);
});

it("keeps the pictures in the order they were picked", async () => {
  await show();

  await pick("ett");
  await pick("tva");
  await pick("tre");

  expect(sources()).toEqual(["file:///dcim/ett-liten.jpg", "file:///dcim/tva-liten.jpg", "file:///dcim/tre-liten.jpg"]);
});

it("asks for the library before opening it, and gives up when it is refused", async () => {
  requestPermission.mockResolvedValue({ granted: false });
  await show();

  await fireEvent.press(addButton());
  await settle();

  expect(getDialog()).toMatchObject({ title: "Tillgång krävs", message: "Tillgång till mediabiblioteket krävs." });
  expect(launchLibrary).not.toHaveBeenCalled();
  expect(screen.queryAllByTestId("image-strip-item")).toHaveLength(0);
});

it("does nothing when the picker is closed without a picture", async () => {
  const { store } = await show();
  launchLibrary.mockResolvedValueOnce({ canceled: true, assets: null });

  await fireEvent.press(addButton());
  await settle();

  expect(resize).not.toHaveBeenCalled();
  expect(onChange).not.toHaveBeenCalled();
  expect(store.get(snackbarAtom).visible).toBe(false);
});

it("takes an iPhone HEIC picture and hands it to the resizer", async () => {
  const { store } = await show();

  await pickAssets([{ uri: "file:///dcim/IMG_0001.heic", mimeType: "image/heic" }]);

  expect(resize).toHaveBeenCalledWith("file:///dcim/IMG_0001.heic");
  expect(screen.queryAllByTestId("image-strip-item")).toHaveLength(1);
  expect(store.get(snackbarAtom).visible).toBe(false);
});

it("says so when the picture cannot be shrunk, and keeps the ones already picked", async () => {
  const { store } = await show();
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
  const { store } = await show();
  launchLibrary.mockRejectedValueOnce(new Error("no library"));

  await fireEvent.press(addButton());
  await settle();

  expect(store.get(snackbarAtom)).toMatchObject({ visible: true, message: "Kunde inte spara bilder" });
  expect(screen.queryAllByTestId("image-strip-item")).toHaveLength(0);
});

it("removes the picture whose cross is pressed, and only that one, without asking", async () => {
  await show();
  await pick("ett");
  await pick("tva");
  await pick("tre");

  await remove(1);

  expect(sources()).toEqual(["file:///dcim/ett-liten.jpg", "file:///dcim/tre-liten.jpg"]);
  expect(onChange).toHaveBeenLastCalledWith([
    picked("file:///dcim/ett-liten.jpg"),
    picked("file:///dcim/tre-liten.jpg"),
  ]);
});

it("removes only the pressed copy when the same photo was picked twice", async () => {
  await show();
  await pick("samma");
  await pick("samma");

  await remove(0);

  expect(sources()).toEqual(["file:///dcim/samma-liten.jpg"]);
});

it("stops offering the picker at three pictures, and offers it again after a removal", async () => {
  await show();
  await pick("ett");
  await pick("tva");
  expect(screen.getByTestId("image-strip-add")).toBeTruthy();

  await pick("tre");
  expect(screen.queryByTestId("image-strip-add")).toBeNull();
  expect(screen.getByTestId("image-strip-count")).toHaveTextContent("3/3");

  await remove(0);
  expect(screen.getByTestId("image-strip-add")).toBeTruthy();
});

it("opens a tapped picture full screen", async () => {
  await show();
  await pick("ett");
  await pick("tva");

  await fireEvent.press(defined(screen.getAllByTestId("image-strip-thumb")[1], "second thumb"));
  await settle();

  expect(screen.getByTestId("image-viewer-list").props.initialScrollIndex).toBe(1);
});

describe("with the images a review already has", () => {
  const stored: ReviewFormImage[] = [
    { kind: "stored", identifier: "img-1", uri: "https://media.stigvidd.se/reviews/1.jpg" },
    { kind: "stored", identifier: "img-2", uri: "https://media.stigvidd.se/reviews/2.jpg" },
  ];

  function showStored() {
    return renderWithProviders(<Form initial={stored} />);
  }

  it("shows them from the start, each with a cross", async () => {
    await showStored();

    expect(sources()).toEqual(["https://media.stigvidd.se/reviews/1.jpg", "https://media.stigvidd.se/reviews/2.jpg"]);
    expect(screen.getAllByTestId("image-strip-remove")).toHaveLength(2);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the identifier of a stored image when another is removed", async () => {
    await showStored();

    await remove(0);

    expect(onChange).toHaveBeenLastCalledWith([stored[1]]);
  });

  it("adds a picked image after the stored ones, as a new one", async () => {
    await showStored();

    await pick("ny");

    expect(onChange).toHaveBeenLastCalledWith([...stored, picked("file:///dcim/ny-liten.jpg")]);
  });

  it("counts the stored images toward the limit of three", async () => {
    await showStored();

    await pick("ny");

    expect(launchLibrary).toHaveBeenCalledWith(expect.not.objectContaining({ allowsMultipleSelection: true }));
    expect(screen.queryByTestId("image-strip-add")).toBeNull();
  });
});
