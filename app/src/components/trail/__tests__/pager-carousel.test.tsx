// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ExampleImageOverlay from "@/components/example-image-overlay";
import PagerCarousel from "@/components/trail/pager-carousel";
import { BORDER_RADIUS } from "@/constants/constants";
import { AppDefaultTheme } from "@/constants/theme";
import { TrailOverview } from "@/data/types";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { Image as ExpoImage } from "expo-image";
import { fireEvent, screen } from "@testing-library/react-native";
import { Dimensions, FlatList, StyleSheet } from "react-native";

const mockNavigate = jest.fn();

jest.mock("expo-router", () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
}));

// Pages are the window minus the host's padding, and the scroll offsets below use the same width.
const WINDOW_WIDTH = Dimensions.get("window").width;
const PADDING = 24;
const PAGE = WINDOW_WIDTH - PADDING;

let clock = 3_000_000;

function trail(overrides: Partial<TrailOverview> = {}): TrailOverview {
  return {
    identifier: "trail-1",
    name: "Skogsleden",
    trailLength: 4.2,
    averageRating: 4,
    ...overrides,
  };
}

const THREE = [
  trail(),
  trail({ identifier: "trail-2", name: "Sjöleden", trailLength: 7.5 }),
  trail({ identifier: "trail-3", name: "Bergsleden", trailLength: 2 }),
];

function show(data: TrailOverview[] = THREE, onItemPress?: (item: TrailOverview) => void) {
  return renderWithProviders(<PagerCarousel data={data} onItemPress={onItemPress} />);
}

// The pager reads its page from the scroll offset; this is the event the platform sends when a swipe settles.
function swipeTo(index: number) {
  fireEvent(screen.UNSAFE_getByType(FlatList), "momentumScrollEnd", {
    nativeEvent: { contentOffset: { x: PAGE * index }, contentSize: { width: PAGE * 3 } },
  });
}

function dotColour(index: number) {
  return StyleSheet.flatten(screen.getByTestId(`carousel-dot-${index}`).props.style).backgroundColor;
}

beforeEach(() => {
  jest.clearAllMocks();
  // guardedNavigate debounces on module state for 500 ms across the whole file.
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("shows each trail with its length", () => {
  show();

  expect(screen.getByText("Skogsleden")).toBeTruthy();
  expect(screen.getByText("4.2 km")).toBeTruthy();
  expect(screen.getByText("Sjöleden")).toBeTruthy();
  expect(screen.getByText("7.5 km")).toBeTruthy();
});

// The dots are the only thing that says how many trails there are to swipe through.
it("gives every trail a dot, and marks the one on screen", () => {
  show();

  expect(screen.getAllByTestId(/carousel-dot-/)).toHaveLength(3);
  expect(dotColour(0)).toBe(AppDefaultTheme.colors.primary);
  expect(dotColour(1)).toBe(AppDefaultTheme.colors.outlineVariant);
});

it("follows a swipe with the dots", async () => {
  show();

  swipeTo(2);
  await settle();

  expect(dotColour(2)).toBe(AppDefaultTheme.colors.primary);
  expect(dotColour(0)).toBe(AppDefaultTheme.colors.outlineVariant);
});

// There is nothing to the left of the first page, so the arrow would be a lie.
it("hides the back arrow on the first page", () => {
  show();

  expect(screen.queryByTestId("carousel-prev")).toBeNull();
  expect(screen.getByTestId("carousel-next").props.accessibilityState).toMatchObject({ disabled: false });
});

it("shows the back arrow once there is something to go back to", async () => {
  show();

  swipeTo(1);
  await settle();

  expect(screen.getByTestId("carousel-prev")).toBeTruthy();
});

it("offers no arrows at all for a single trail", () => {
  show([trail()]);

  expect(screen.queryByTestId("carousel-next")).toBeNull();
  expect(screen.queryByTestId("carousel-prev")).toBeNull();
  expect(screen.getAllByTestId(/carousel-dot-/)).toHaveLength(1);
});

it("steps forward on the arrow", async () => {
  show();

  fireEvent.press(screen.getByTestId("carousel-next"));
  await settle();

  expect(dotColour(1)).toBe(AppDefaultTheme.colors.primary);
});

it("steps back again", async () => {
  show();

  fireEvent.press(screen.getByTestId("carousel-next"));
  await settle();
  fireEvent.press(screen.getByTestId("carousel-prev"));
  await settle();

  expect(dotColour(0)).toBe(AppDefaultTheme.colors.primary);
});

// Past the last trail the arrow dims rather than disappearing, which would shift the layout under the thumb.
it("dims the forward arrow on the last page and stops there", async () => {
  show();

  swipeTo(2);
  await settle();

  const next = screen.getByTestId("carousel-next");
  expect(next).toHaveStyle({ opacity: 0.4, backgroundColor: "rgba(0,0,0,0.15)" });
  // goTo clamps as well, and a screen reader is told the arrow is disabled rather than left to announce it.
  expect(next.props.accessibilityState).toMatchObject({ disabled: true });
  fireEvent.press(next);
  await settle();

  expect(dotColour(2)).toBe(AppDefaultTheme.colors.primary);
});

it("opens the trail that was pressed", () => {
  show();

  fireEvent.press(screen.getByText("Sjöleden"));

  expect(mockNavigate).toHaveBeenCalledWith({
    pathname: "/(tabs)/(home)/trail/[identifier]",
    params: { identifier: "trail-2" },
  });
});

// A host that passes its own handler puts the carousel somewhere the home route is wrong.
it("leaves the press to its host when it was given one", () => {
  const onItemPress = jest.fn();
  show(THREE, onItemPress);

  fireEvent.press(screen.getByText("Skogsleden"));

  expect(onItemPress).toHaveBeenCalledWith(expect.objectContaining({ identifier: "trail-1" }));
  expect(mockNavigate).not.toHaveBeenCalled();
});

it("shows the trail's own first image", () => {
  show([trail({ trailImagesResponse: [{ identifier: "img-1", imageUrl: "https://stigvidd.se/a.jpg" }] })]);

  expect(screen.UNSAFE_getAllByType(ExpoImage)[0].props.source).toBe("https://stigvidd.se/a.jpg");
});

// A trail with no photographs still has to fill the page, so a bundled placeholder stands in.
it("falls back to the bundled placeholder when a trail has no images", () => {
  show([trail({ trailImagesResponse: [] })]);

  // A require() is an asset handle rather than a URL; anything but a string is the local one.
  expect(typeof screen.UNSAFE_getAllByType(ExpoImage)[0].props.source).not.toBe("string");
});

it("hands the overlay the same image it is drawn over", () => {
  show([trail({ trailImagesResponse: [{ identifier: "img-1", imageUrl: "https://stigvidd.se/mock/a.jpg" }] })]);

  expect(screen.UNSAFE_getAllByType(ExampleImageOverlay)[0].props.source).toBe("https://stigvidd.se/mock/a.jpg");
});

// The placeholder art is ours, so it must not be labelled as a stand-in for a photograph.
it("labels a mock photograph, and leaves a real one alone", () => {
  show([trail({ trailImagesResponse: [{ identifier: "img-1", imageUrl: "https://stigvidd.se/mock/a.jpg" }] })]);
  fireEvent(screen.UNSAFE_getAllByProps({ pointerEvents: "none" })[0], "layout", {
    nativeEvent: { layout: { width: 300, height: 180 } },
  });

  expect(screen.getByText("Exempelbild")).toBeTruthy();

  screen.unmount();
  show([trail({ trailImagesResponse: [{ identifier: "img-1", imageUrl: "https://stigvidd.se/riktig.jpg" }] })]);

  expect(screen.queryByText("Exempelbild")).toBeNull();
});

it("sizes each page to the window, and the picture to the page", () => {
  show();

  expect(screen.UNSAFE_getAllByType(ExpoImage)[0].props.style).toEqual(
    expect.objectContaining({ width: PAGE, height: Math.round(PAGE * 0.6), borderRadius: BORDER_RADIUS }),
  );
});

// The arrows float over the picture, centred on its height rather than the page's.
it("centres the arrows over the picture, one at each edge", () => {
  show();

  swipeTo(1);

  expect(screen.getByTestId("carousel-prev")).toHaveStyle({
    position: "absolute",
    top: "50%",
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    left: 8,
  });
  expect(screen.getByTestId("carousel-next")).toHaveStyle({ position: "absolute", right: 8 });
});

it("lays the dots out in a centred row under the picture", () => {
  show();

  expect(screen.getByTestId("carousel-dots")).toHaveStyle({
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  });
  expect(screen.getByTestId("carousel-dot-0")).toHaveStyle({ width: 6, height: 6, borderRadius: 3 });
});
