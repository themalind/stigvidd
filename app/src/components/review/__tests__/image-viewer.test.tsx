// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ImageViewer from "@/components/review/image-viewer";
import { BORDER_RADIUS } from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { ReviewImage } from "@/data/types";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Dimensions, StyleSheet } from "react-native";

const { width: WIDTH, height: HEIGHT } = Dimensions.get("screen");
const ITEM_WIDTH = WIDTH - 40;

const onDismiss = jest.fn();

function images(count: number): ReviewImage[] {
  return Array.from({ length: count }, (_, i) => ({
    identifier: `image-${i + 1}`,
    imageUrl: `https://media.stigvidd.se/reviews/bild-${i + 1}.jpg`,
  }));
}

function show(
  list: ReviewImage[] = images(3),
  visible = true,
  theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme,
) {
  return renderWithProviders(<ImageViewer images={list} visible={visible} onDismiss={onDismiss} />, { theme });
}

function list() {
  return screen.getByTestId("review-image-list");
}

// The gallery's own scroll: the platform reports where the strip came to rest.
async function scrollTo(offset: number) {
  fireEvent(list(), "momentumScrollEnd", { nativeEvent: { contentOffset: { x: offset }, layoutMeasurement: {} } });
  await settle();
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows every picture the review carries", () => {
  show();

  expect(screen.getAllByTestId("review-image-item")).toHaveLength(3);
  expect(screen.UNSAFE_getAllByType(Image).map((image) => image.props.source)).toEqual([
    "https://media.stigvidd.se/reviews/bild-1.jpg",
    "https://media.stigvidd.se/reviews/bild-2.jpg",
    "https://media.stigvidd.se/reviews/bild-3.jpg",
  ]);
});

it("stays out of sight until it is opened", () => {
  show(images(3), false);

  expect(screen.queryByTestId("review-image-item")).toBeNull();
  expect(screen.UNSAFE_queryByType(BlurView)).toBeNull();
});

// A review photo is shown whole rather than cropped.
it("shows each picture whole, at the same size as the others", () => {
  show();

  for (const image of screen.UNSAFE_getAllByType(Image)) {
    expect(image.props.contentFit).toBe("contain");
    expect(StyleSheet.flatten(image.props.style)).toMatchObject({ height: HEIGHT * 0.5, width: WIDTH * 0.7 });
  }
});

it("gives each picture the full width of the modal to sit in", () => {
  show();

  expect(screen.getAllByTestId("review-image-item")[0]).toHaveStyle({
    width: ITEM_WIDTH,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  });
});

// One swipe is one picture, not a free scroll that leaves two half-shown.
it("moves one whole picture per swipe, and stops at the ends", () => {
  show();

  expect(list().props.horizontal).toBe(true);
  expect(list().props.pagingEnabled).toBe(true);
  expect(list().props.bounces).toBe(false);
  expect(list().props.showsHorizontalScrollIndicator).toBe(false);
});

// Every picture is exactly as wide as the modal, so the strip scrolls to one without measuring.
it("lays the strip out in equal steps", () => {
  show();

  expect(list().props.getItemLayout(null, 2)).toEqual({ length: ITEM_WIDTH, offset: ITEM_WIDTH * 2, index: 2 });
});

it("keys the strip on the image's own identifier", () => {
  show();

  expect(list().props.keyExtractor({ identifier: "image-2" })).toBe("image-2");
});

// Reopening the gallery lands on the picture that was being looked at.
it("comes back to the picture that was left on screen", async () => {
  show();
  expect(list().props.initialScrollIndex).toBe(0);

  await scrollTo(ITEM_WIDTH * 2);

  expect(list().props.initialScrollIndex).toBe(2);
});

// The strip can rest a few pixels off, so the nearest picture wins. A page is the gallery's width,
// not the screen's, which would drift a whole picture out by the end of a long gallery.
it("counts the picture nearest to where the swipe stopped", async () => {
  show(images(4));

  await scrollTo(ITEM_WIDTH * 0.6);
  expect(list().props.initialScrollIndex).toBe(1);

  await scrollTo(ITEM_WIDTH * 1.4);
  expect(list().props.initialScrollIndex).toBe(1);

  // Stopped exactly between two pictures: the one being swiped towards.
  await scrollTo(ITEM_WIDTH * 2.5);
  expect(list().props.initialScrollIndex).toBe(3);
});

// One picture is not a gallery: dots under it would suggest there is more to swipe to.
it("shows no dots for a single picture", () => {
  show(images(1));

  expect(screen.queryByTestId("review-image-pagination")).toBeNull();
  expect(screen.queryAllByTestId("review-image-dot")).toHaveLength(0);
});

it("marks one dot per picture, with a ring around the one being shown", () => {
  show();

  expect(screen.getAllByTestId("review-image-dot")).toHaveLength(3);
  expect(screen.getByTestId("review-image-indicator")).toBeTruthy();
});

it("sets the dots in the theme's accent, and the ring in its primary", () => {
  show();

  expect(screen.getAllByTestId("review-image-dot")[0]).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.tertiary,
    width: 8,
    height: 8,
    borderRadius: 8,
    marginRight: 8,
  });
  expect(screen.getByTestId("review-image-indicator")).toHaveStyle({
    borderColor: AppDefaultTheme.colors.primary,
    borderWidth: 2,
    width: 16,
    height: 16,
    borderRadius: 16,
  });
});

// The ring is one dot larger than a dot, so it is pulled back by half the gap to sit around one.
it("centres the ring on the dot it marks", () => {
  show();

  expect(screen.getByTestId("review-image-indicator")).toHaveStyle({
    position: "absolute",
    top: -4,
    left: -4,
  });
});

it("carries the dark theme's colours too", () => {
  show(images(3), true, AppDarkTheme);

  expect(screen.getAllByTestId("review-image-dot")[0]).toHaveStyle({ backgroundColor: AppDarkTheme.colors.tertiary });
  expect(screen.getByTestId("review-image-indicator")).toHaveStyle({ borderColor: AppDarkTheme.colors.primary });
  expect(screen.getByTestId("modal-surface")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.inverseOnSurface });
});

// The dots lie over the bottom of the picture, so the gallery keeps the height it was given.
it("lays the dots across the bottom of the picture", () => {
  show();

  expect(screen.getByTestId("review-image-pagination")).toHaveStyle({
    flexDirection: "row",
    alignSelf: "center",
    transform: [{ translateY: -20 }],
  });
});

it("keeps the gallery inside the screen, on the theme's own backdrop", () => {
  show();

  // Paper keeps the outer margin one layer above the surface and the rest of the layout on it.
  expect(screen.getByTestId("modal-surface-outer-layer")).toHaveStyle({ margin: 20 });
  // justifyContent is left out: Paper's modal already centres its content.
  expect(screen.getByTestId("modal-surface")).toHaveStyle({
    maxHeight: HEIGHT * 0.6,
    maxWidth: WIDTH,
    alignItems: "center",
    flexDirection: "row",
    borderRadius: BORDER_RADIUS,
    backgroundColor: AppDefaultTheme.colors.inverseOnSurface,
  });
});

// The strip is wider than the modal, and the clip keeps its neighbours off the rounded corners.
it("clips the strip to the gallery's rounded corners", () => {
  show();

  expect(screen.getByTestId("review-image-frame")).toHaveStyle({
    position: "relative",
    overflow: "hidden",
    borderRadius: BORDER_RADIUS,
  });
});

it("blurs the screen behind the gallery", () => {
  show();

  const blur = screen.UNSAFE_getByType(BlurView);
  expect(blur.props.intensity).toBe(100);
  expect(blur.props.tint).toBe("dark");
  expect(StyleSheet.flatten(blur.props.style)).toMatchObject({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  });
});

it("closes when the screen behind the picture is tapped", async () => {
  show();

  fireEvent.press(screen.getByTestId("modal-backdrop"));
  await settle();

  expect(onDismiss).toHaveBeenCalled();
});
