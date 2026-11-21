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
import { Dimensions, Text } from "react-native";

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

async function swipeToCard(index: number) {
  await fireEvent(screen.getByTestId("test-carousel-list"), "momentumScrollEnd", {
    nativeEvent: {
      contentOffset: { x: index * (CARD_WIDTH + SCREEN_PADDING) },
      contentSize: {},
      layoutMeasurement: {},
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
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
  const opening = ["tap"];
  const { rerender } = await renderWithProviders(carousel(["a", "b"], opening));
  await swipeToCard(1);

  await rerender(carousel(["a", "b"], opening));

  expect(screen.getByTestId("card-b")).toHaveTextContent("active", { exact: false });
});

it("starts at the first card for a new opening, even of the same items", async () => {
  const { rerender } = await renderWithProviders(carousel(["a", "b"], ["tap"]));
  await swipeToCard(1);

  await rerender(carousel(["a", "b"], ["another tap"]));

  expect(screen.getByTestId("card-a")).toHaveTextContent("active", { exact: false });
  expect(onActiveChange).toHaveBeenLastCalledWith("a");
});
