// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import TrailCardCarousel from "@/components/map/trail-card-carousel";
import { SCREEN_PADDING } from "@/constants/constants";
import { AppDefaultTheme } from "@/constants/theme";
import { TrailCard } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { Dimensions } from "react-native";

const mockUseTrailCards = jest.fn();

jest.mock("@/hooks/useTrailCard", () => ({
  useTrailCards: (identifiers: string[]) => mockUseTrailCards(identifiers),
}));

const SCREEN_WIDTH = Dimensions.get("window").width;
const PEEK = 44;
const CARD_WIDTH = SCREEN_WIDTH - SCREEN_PADDING * 2 - PEEK;
const SINGLE_CARD_WIDTH = SCREEN_WIDTH - SCREEN_PADDING * 2;

function card(identifier: string, overrides: Partial<TrailCard> = {}): TrailCard {
  return {
    identifier,
    name: `Led ${identifier}`,
    trailLength: 3.5,
    classification: 1,
    isAccessible: false,
    averageRating: 4,
    ...overrides,
  };
}

function state(cards: TrailCard[], overrides: Partial<ReturnType<typeof mockUseTrailCards>> = {}) {
  return {
    cards: Object.fromEntries(cards.map((c) => [c.identifier, c])),
    isLoading: false,
    isError: false,
    notFound: new Set<string>(),
    refetch: jest.fn(),
    ...overrides,
  };
}

const noop = () => {};

function show(identifiers: string[], props: Partial<React.ComponentProps<typeof TrailCardCarousel>> = {}) {
  return renderWithProviders(
    <TrailCardCarousel identifiers={identifiers} onClose={noop} onReadMore={noop} onShowOnMap={noop} {...props} />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTrailCards.mockReturnValue(state([card("a"), card("b"), card("c")]));
});

// initialNumToRender is 2, so a three-trail cluster mounts two cards and builds the third on scroll.
it("shows a card per trail in the cluster, up to what the list has mounted", () => {
  show(["a", "b", "c"]);

  expect(screen.getByText("Led a")).toBeTruthy();
  expect(screen.getByText("Led b")).toBeTruthy();
  expect(screen.queryByText("Led c")).toBeNull();
  expect(screen.getAllByText("3.5 km")).toHaveLength(2);
});

// A card narrower than the screen shows a sliver of the next one, which is what reads as scrollable.
it("leaves the next card peeking when there is more than one", () => {
  show(["a", "b", "c"]);

  expect(screen.getByTestId("carousel-card-a")).toHaveStyle({ width: CARD_WIDTH });
  expect(CARD_WIDTH).toBeLessThan(SINGLE_CARD_WIDTH);
});

// A lone card has nothing to peek at, so it takes the full width.
it("lets a lone card fill the width", () => {
  mockUseTrailCards.mockReturnValue(state([card("a")]));
  show(["a"]);

  expect(screen.getByTestId("carousel-card-a")).toHaveStyle({ width: SINGLE_CARD_WIDTH });
});

// Snapping lands on a card boundary only while the snap interval, the gap and getItemLayout's
// offsets agree — three expressions over the same two constants.
it("snaps by exactly one card plus the gap between cards", () => {
  show(["a", "b", "c"]);
  const list = screen.getByTestId("carousel-list");

  expect(list.props.snapToInterval).toBe(CARD_WIDTH + SCREEN_PADDING);
  expect(list.props.contentContainerStyle).toMatchObject({ gap: SCREEN_PADDING, paddingHorizontal: SCREEN_PADDING });
  expect(list.props.getItemLayout(null, 2)).toEqual({
    length: CARD_WIDTH,
    offset: SCREEN_PADDING + 2 * (CARD_WIDTH + SCREEN_PADDING),
    index: 2,
  });
});

it("marks which card is showing, and moves the mark when the list settles on another", () => {
  show(["a", "b", "c"]);

  expect(screen.getByText("1/3")).toBeTruthy();

  fireEvent(screen.getByTestId("carousel-list"), "momentumScrollEnd", {
    nativeEvent: { contentOffset: { x: CARD_WIDTH + SCREEN_PADDING }, contentSize: {}, layoutMeasurement: {} },
  });

  // Only the dots follow the scroll; each card keeps its own counter.
  const dots = screen.getByTestId("carousel-list").parent;
  expect(dots).toBeTruthy();
  expect(screen.getByText("2/3")).toBeTruthy();
});

// A single card is the whole carousel, so dots would be one dot: noise.
it("draws dots only for a cluster, with the active one widened", () => {
  const { unmount } = show(["a", "b", "c"]);

  const active = screen.getAllByTestId("carousel-dot");
  expect(active).toHaveLength(3);
  expect(active[0]).toHaveStyle({ width: 18, backgroundColor: AppDefaultTheme.colors.primary });
  expect(active[1]).toHaveStyle({ width: 6, backgroundColor: AppDefaultTheme.colors.outlineVariant });

  unmount();
  mockUseTrailCards.mockReturnValue(state([card("a")]));
  show(["a"]);
  expect(screen.queryAllByTestId("carousel-dot")).toHaveLength(0);
});

// The map lifts its attribution clear of the carousel, so the height includes the gap below it.
it("reports its height plus the gap below it", () => {
  const onMeasure = jest.fn();
  show(["a", "b", "c"], { onMeasure });

  fireEvent(screen.getByTestId("carousel"), "layout", { nativeEvent: { layout: { height: 150 } } });

  expect(onMeasure).toHaveBeenCalledWith(166);
});

it("offers a retry only when there is something to retry", () => {
  const refetch = jest.fn();
  mockUseTrailCards.mockReturnValue(state([], { isError: true, refetch }));
  const { unmount } = show(["a"]);

  expect(screen.getByText("Kunde inte ladda den här leden")).toBeTruthy();
  fireEvent.press(screen.getByText("Försök igen"));
  expect(refetch).toHaveBeenCalledTimes(1);

  unmount();
  mockUseTrailCards.mockReturnValue(state([], { notFound: new Set(["a"]) }));
  show(["a"]);

  expect(screen.getByText("Den här leden är inte längre tillgänglig")).toBeTruthy();
  expect(screen.queryByText("Försök igen")).toBeNull();
});

it("hands the pressed card's identifier to the caller", () => {
  const onReadMore = jest.fn();
  const onShowOnMap = jest.fn();
  show(["a", "b", "c"], { onReadMore, onShowOnMap });

  fireEvent.press(screen.getAllByText("Läs mer")[0]);
  fireEvent.press(screen.getAllByText("Se på karta")[0]);

  expect(onReadMore).toHaveBeenCalledWith("a");
  expect(onShowOnMap).toHaveBeenCalledWith("a");
});
