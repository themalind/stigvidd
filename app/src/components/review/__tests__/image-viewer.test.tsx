// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ImageViewer from "@/components/review/image-viewer";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { ReviewImage } from "@/data/types";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { ZOOM_TYPE, Zoomable } from "@likashefqet/react-native-image-zoom";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Image } from "expo-image";
import { Dimensions, StyleSheet } from "react-native";

const { width: ITEM_WIDTH, height: ITEM_HEIGHT } = Dimensions.get("window");

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
  expect(screen.queryByTestId("image-viewer-close")).toBeNull();
});

it("shows each picture whole, filling the screen", () => {
  show();

  for (const image of screen.UNSAFE_getAllByType(Image)) {
    expect(image.props.contentFit).toBe("contain");
    expect(StyleSheet.flatten(image.props.style)).toMatchObject({ width: "100%", height: "100%" });
  }
  expect(screen.getAllByTestId("review-image-item")[0]).toHaveStyle({ width: ITEM_WIDTH, height: ITEM_HEIGHT });
});

it("covers the whole screen in black, whatever the theme", () => {
  show(images(3), true, AppDarkTheme);

  expect(screen.getByTestId("modal-wrapper")).toHaveStyle({ marginTop: 0, marginBottom: 0 });
  expect(screen.getByTestId("modal-surface-outer-layer")).toHaveStyle({ flex: 1 });
  expect(screen.getByTestId("modal-surface")).toHaveStyle({ backgroundColor: "#000" });
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

// The strip can rest a few pixels off, so the nearest picture wins. keep-comment: why rounding
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
});

it("lays the dots over the bottom of the picture", () => {
  show();

  expect(screen.getByTestId("review-image-pagination")).toHaveStyle({
    position: "absolute",
    flexDirection: "row",
    alignSelf: "center",
  });
});

describe("closing", () => {
  it("closes from the cross, handing back the picture it was on", async () => {
    show();
    await scrollTo(ITEM_WIDTH * 2);

    fireEvent.press(screen.getByTestId("image-viewer-close"));

    expect(onDismiss).toHaveBeenCalledWith(2);
  });

  it("hands back the picture it was on when Paper dismisses it", async () => {
    show();
    await scrollTo(ITEM_WIDTH);

    fireEvent.press(screen.getByTestId("modal-backdrop"));
    await settle();

    expect(onDismiss).toHaveBeenCalledWith(1);
  });
});

describe("zooming", () => {
  function zoom() {
    return screen.UNSAFE_getAllByType(Zoomable)[0];
  }

  it("lets a picture be pinched and double-tapped up to five times its size", () => {
    show();

    expect(zoom().props.maxScale).toBe(5);
    expect(zoom().props.isDoubleTapEnabled).toBe(true);
  });

  it("stops the swipe to the next picture while zoomed in, so a drag pans instead", () => {
    show();
    expect(list().props.scrollEnabled).toBe(true);

    act(() => zoom().props.onPinchStart());

    expect(list().props.scrollEnabled).toBe(false);
    expect(screen.queryByTestId("review-image-pagination")).toBeNull();
  });

  it("swipes again once zoomed back out", () => {
    show();
    act(() => zoom().props.onDoubleTap(ZOOM_TYPE.ZOOM_IN));
    expect(list().props.scrollEnabled).toBe(false);

    act(() => zoom().props.onResetAnimationEnd());

    expect(list().props.scrollEnabled).toBe(true);
  });

  it("swipes again after a double tap that zooms out", () => {
    show();
    act(() => zoom().props.onPinchStart());

    act(() => zoom().props.onDoubleTap(ZOOM_TYPE.ZOOM_OUT));

    expect(list().props.scrollEnabled).toBe(true);
  });

  it("opens unzoomed even if it was closed zoomed in", async () => {
    const { rerender } = renderWithProviders(<ImageViewer images={images(2)} visible onDismiss={onDismiss} />);
    act(() => zoom().props.onPinchStart());

    rerender(<ImageViewer images={images(2)} visible={false} onDismiss={onDismiss} />);
    await settle();
    rerender(<ImageViewer images={images(2)} visible onDismiss={onDismiss} />);
    await settle();

    expect(list().props.scrollEnabled).toBe(true);
  });
});

describe("opening on a chosen picture", () => {
  it("starts on the picture it was opened on", () => {
    renderWithProviders(<ImageViewer images={images(4)} visible initialIndex={2} onDismiss={onDismiss} />);

    expect(list().props.initialScrollIndex).toBe(2);
  });

  it("starts on the newly chosen picture each time it is reopened", async () => {
    const { rerender } = renderWithProviders(
      <ImageViewer images={images(4)} visible={false} initialIndex={0} onDismiss={onDismiss} />,
    );

    rerender(<ImageViewer images={images(4)} visible initialIndex={3} onDismiss={onDismiss} />);
    await settle();

    expect(list().props.initialScrollIndex).toBe(3);
  });
});

describe("deleting", () => {
  const onDelete = jest.fn();

  beforeEach(() => {
    onDelete.mockResolvedValue(undefined);
  });

  it("offers no bin when the viewer may not delete", () => {
    show();

    expect(screen.queryByTestId("image-viewer-delete")).toBeNull();
  });

  it("asks before deleting, and deletes the picture on screen", async () => {
    renderWithProviders(
      <ImageViewer images={images(3)} visible initialIndex={1} onDismiss={onDismiss} onDelete={onDelete} />,
    );

    fireEvent.press(screen.getByTestId("image-viewer-delete"));
    await settle();
    expect(screen.getByText("Ta bort bilden?")).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.press(screen.getAllByText("Ta bort").at(-1) ?? screen.getByText("Ta bort"));
    await settle();

    expect(onDelete).toHaveBeenCalledWith(images(3)[1]);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("deletes nothing when the question is cancelled", async () => {
    renderWithProviders(<ImageViewer images={images(2)} visible onDismiss={onDismiss} onDelete={onDelete} />);

    fireEvent.press(screen.getByTestId("image-viewer-delete"));
    await settle();
    fireEvent.press(screen.getByText("Avbryt"));
    await settle();

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("closes once the last picture is gone", async () => {
    renderWithProviders(<ImageViewer images={images(1)} visible onDismiss={onDismiss} onDelete={onDelete} />);

    fireEvent.press(screen.getByTestId("image-viewer-delete"));
    await settle();
    fireEvent.press(screen.getAllByText("Ta bort").at(-1) ?? screen.getByText("Ta bort"));
    await settle();

    expect(onDismiss).toHaveBeenCalled();
  });

  it("stays open on a failed delete", async () => {
    onDelete.mockRejectedValue(new Error("500"));
    renderWithProviders(<ImageViewer images={images(1)} visible onDismiss={onDismiss} onDelete={onDelete} />);

    fireEvent.press(screen.getByTestId("image-viewer-delete"));
    await settle();
    fireEvent.press(screen.getAllByText("Ta bort").at(-1) ?? screen.getByText("Ta bort"));
    await settle();

    expect(onDelete).toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("moves back onto the new last picture when the last one is deleted", async () => {
    const { rerender } = renderWithProviders(
      <ImageViewer images={images(3)} visible initialIndex={2} onDismiss={onDismiss} onDelete={onDelete} />,
    );

    fireEvent.press(screen.getByTestId("image-viewer-delete"));
    await settle();
    fireEvent.press(screen.getAllByText("Ta bort").at(-1) ?? screen.getByText("Ta bort"));
    await settle();
    rerender(<ImageViewer images={images(2)} visible initialIndex={2} onDismiss={onDismiss} onDelete={onDelete} />);
    await settle();

    expect(list().props.initialScrollIndex).toBe(1);
  });
});

describe("reporting", () => {
  const onReport = jest.fn();

  it("offers a flag that reports the picture on screen", () => {
    renderWithProviders(
      <ImageViewer images={images(3)} visible initialIndex={2} onDismiss={onDismiss} onReport={onReport} />,
    );

    fireEvent.press(screen.getByTestId("image-viewer-report"));

    expect(onReport).toHaveBeenCalledWith(images(3)[2]);
  });

  it("offers no flag to someone who may delete the picture", () => {
    renderWithProviders(
      <ImageViewer images={images(2)} visible onDismiss={onDismiss} onDelete={jest.fn()} onReport={onReport} />,
    );

    expect(screen.queryByTestId("image-viewer-report")).toBeNull();
    expect(screen.getByTestId("image-viewer-delete")).toBeTruthy();
  });

  it("offers no flag when nobody asked for one", () => {
    renderWithProviders(<ImageViewer images={images(2)} visible onDismiss={onDismiss} />);

    expect(screen.queryByTestId("image-viewer-report")).toBeNull();
  });
});
