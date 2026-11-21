// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import MapCardCarousel, { type CarouselCardLayout } from "@/components/map/map-card-carousel";
import { SCREEN_PADDING } from "@/constants/constants";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { Dimensions, FlatList, Text } from "react-native";

const CARD_WIDTH = Dimensions.get("window").width - SCREEN_PADDING * 2 - 44;
const onActiveChange = jest.fn();

function keyOf(item: string) {
  return item;
}

function renderCard(item: string, { width, position, active }: CarouselCardLayout) {
  return (
    <Text testID={`card-${item}`} style={{ width }}>
      {`${item} ${position ?? "alone"} ${active ? "active" : "idle"}`}
    </Text>
  );
}

function carousel(items: string[], opening: unknown) {
  return (
    <MapCardCarousel
      testID="test-carousel"
      items={items}
      opening={opening}
      keyOf={keyOf}
      renderCard={renderCard}
      onClose={jest.fn()}
      onActiveChange={onActiveChange}
      bottomOffset={SCREEN_PADDING}
    />
  );
}

function atCard(index: number) {
  return {
    nativeEvent: {
      contentOffset: { x: index * (CARD_WIDTH + SCREEN_PADDING), y: 0 },
      contentSize: {},
      layoutMeasurement: {},
    },
  };
}

function list() {
  return screen.getByTestId("test-carousel-list");
}

async function swipeToCard(index: number) {
  await fireEvent(list(), "momentumScrollEnd", atCard(index));
}

async function dragTo(index: number) {
  await fireEvent(list(), "scrollBeginDrag", atCard(0));
  await fireEvent(list(), "scrollEndDrag", atCard(index));
}

async function readSecondCard(items: string[]) {
  const opening = ["tap"];
  const { rerender } = await renderWithProviders(carousel(items, opening));
  await swipeToCard(1);
  return {
    scrollToOffset: jest.spyOn(FlatList.prototype, "scrollToOffset"),
    refetch: (next: string[]) => rerender(carousel(next, opening)),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("tells each card its width, its place in the list and whether it is the one showing", async () => {
  await renderWithProviders(carousel(["a", "b"], "first"));

  expect(screen.getByTestId("card-a")).toHaveTextContent("a 1/2 active");
  expect(screen.getByTestId("card-b")).toHaveTextContent("b 2/2 idle");
  expect(screen.getByTestId("card-a")).toHaveStyle({ width: CARD_WIDTH });
});

it("reports the card it opens on and each card it settles on", async () => {
  await renderWithProviders(carousel(["a", "b"], "first"));
  expect(onActiveChange).toHaveBeenLastCalledWith("a");

  await swipeToCard(1);

  expect(onActiveChange).toHaveBeenLastCalledWith("b");
});

// keep-comment: a vote refetches new objects for the same opening; jumping back would lose the reader's place
it("keeps the card showing when new items arrive for the same opening", async () => {
  const { refetch } = await readSecondCard(["a", "b"]);

  await refetch(["a", "b"]);

  expect(screen.getByTestId("card-b")).toHaveTextContent("active", { exact: false });
});

// keep-comment: an obstacle solved by votes leaves the list while its neighbours stay open
it("stays on the card being read when an earlier card is dropped, and moves the list with it", async () => {
  const { refetch, scrollToOffset } = await readSecondCard(["a", "b", "c"]);

  await refetch(["b", "c"]);

  expect(screen.getByTestId("card-b")).toHaveTextContent("b 1/2 active");
  expect(onActiveChange).toHaveBeenLastCalledWith("b");
  expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 0, animated: false });
});

it("lands on the first card when the card being read is dropped, and moves the list there", async () => {
  const { refetch, scrollToOffset } = await readSecondCard(["a", "b"]);

  await refetch(["a"]);

  expect(screen.getByTestId("card-a")).toHaveTextContent("a alone active");
  expect(onActiveChange).toHaveBeenLastCalledWith("a");
  expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 0, animated: false });
});

// keep-comment: a withdrawn vote can bring the dropped card back; the reader has moved on by then
it("stays on the card it moved to when a dropped card comes back", async () => {
  const { refetch } = await readSecondCard(["a", "b"]);
  await refetch(["a"]);

  await refetch(["a", "b"]);

  expect(screen.getByTestId("card-a")).toHaveTextContent("a 1/2 active");
  expect(onActiveChange).toHaveBeenLastCalledWith("a");
});

// keep-comment: the list is already where the finger left it; moving it again makes it jump under a new swipe
it("never moves the list itself after a swipe", async () => {
  await renderWithProviders(carousel(["a", "b", "c"], "first"));
  const scrollToOffset = jest.spyOn(FlatList.prototype, "scrollToOffset");

  await dragTo(1);
  await swipeToCard(2);

  expect(scrollToOffset).not.toHaveBeenCalled();
});

// keep-comment: iOS sends no momentum end when a finger stops a fling, so letting go must settle the card
it("settles on the card a finger lets go on, even when no momentum end follows", async () => {
  await renderWithProviders(carousel(["a", "b", "c"], ["tap"]));

  await dragTo(1);
  await fireEvent(list(), "momentumScrollBegin", atCard(1));

  expect(screen.getByTestId("card-b")).toHaveTextContent("active", { exact: false });
  expect(onActiveChange).toHaveBeenLastCalledWith("b");
});

it("moves a list a finger left mid-fling to the first card of a new opening", async () => {
  const { rerender } = await renderWithProviders(carousel(["a", "b"], ["tap"]));
  await dragTo(1);
  await fireEvent(list(), "momentumScrollBegin", atCard(1));
  const scrollToOffset = jest.spyOn(FlatList.prototype, "scrollToOffset");

  await rerender(carousel(["c", "d"], ["another tap"]));

  expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: 0, animated: false });
  expect(screen.getByTestId("card-c")).toHaveTextContent("active", { exact: false });
});

it("leaves the list alone under a finger when cards are dropped, and holds the card it is let go on", async () => {
  const { refetch, scrollToOffset } = await readSecondCard(["a", "b", "c"]);
  await fireEvent(list(), "scrollBeginDrag", atCard(1));

  await refetch(["b", "c"]);
  expect(scrollToOffset).not.toHaveBeenCalled();

  await fireEvent(list(), "scrollEndDrag", atCard(1));
  expect(screen.getByTestId("card-c")).toHaveTextContent("c 2/2 active");
  expect(onActiveChange).toHaveBeenLastCalledWith("c");
  expect(scrollToOffset).not.toHaveBeenCalled();
});

it("starts at the first card for a new opening, even of the same items", async () => {
  const { rerender } = await renderWithProviders(carousel(["a", "b"], ["tap"]));
  await swipeToCard(1);

  await rerender(carousel(["a", "b"], ["another tap"]));

  expect(screen.getByTestId("card-a")).toHaveTextContent("active", { exact: false });
  expect(onActiveChange).toHaveBeenLastCalledWith("a");
});
