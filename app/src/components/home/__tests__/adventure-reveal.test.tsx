// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AdventureReveal from "@/components/home/adventure-reveal";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { TrailCard, TrailShortInfoResponse } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { Image } from "expo-image";

let mockCard: { card: TrailCard | null; isLoading: boolean };

jest.mock("@/hooks/useTrailCard", () => ({
  useTrailCard: () => mockCard,
}));

const TRAIL: TrailShortInfoResponse = {
  identifier: "t-1",
  name: "Kypesjön runt",
  trailLength: 5.2,
  accessibility: false,
  classification: 1,
  city: "Borås",
  averageRating: 0,
};

type AppTheme = typeof AppDefaultTheme | typeof AppDarkTheme;

const CARD: TrailCard = {
  identifier: "t-1",
  name: "Kypesjön runt",
  trailLength: 5.2,
  classification: 1,
  isAccessible: false,
  averageRating: 4.2,
  image: { identifier: "img-1", imageUrl: "https://media.example/kype.jpg" },
};

function show(trail: TrailShortInfoResponse = TRAIL, theme: AppTheme = AppDefaultTheme) {
  const onOpen = jest.fn();
  const onReroll = jest.fn();
  const rendered = renderWithProviders(<AdventureReveal trail={trail} onOpen={onOpen} onReroll={onReroll} />, {
    theme,
  });
  return { onOpen, onReroll, ...rendered };
}

function images() {
  return screen.UNSAFE_queryAllByType(Image);
}

beforeEach(() => {
  mockCard = { card: null, isLoading: false };
});

describe("AdventureReveal", () => {
  it("names the trail from the list it was drawn from, before any card arrives", () => {
    mockCard = { card: null, isLoading: true };
    show();

    expect(screen.getByText("Kypesjön runt")).toBeTruthy();
    expect(screen.getByText("Borås")).toBeTruthy();
    expect(screen.getByText("5.2 km")).toBeTruthy();
    expect(screen.getByText("Lätt")).toBeTruthy();
  });

  it("shows no image while the card is loading", () => {
    mockCard = { card: null, isLoading: true };
    show();

    expect(images()).toHaveLength(0);
  });

  it("shows the photo and rating once the card arrives", () => {
    mockCard = { card: CARD, isLoading: false };
    show();

    expect(images()).toHaveLength(1);
    expect(images()[0].props.source).toEqual({ uri: "https://media.example/kype.jpg" });
    expect(screen.getByText("★ 4.2")).toBeTruthy();
  });

  // "Inga recensioner" is as wide as a trail name and would squeeze it on a shared row.
  it("never shares the name's line with the rating", () => {
    mockCard = { card: { ...CARD, averageRating: 0 }, isLoading: false };
    show();

    expect(screen.getByText("Inga recensioner än")).toBeTruthy();
    // The box a Text lays out in is the nearest View above it, past the composite wrappers.
    let box = screen.getByText("Kypesjön runt").parent;
    while (box && box.type !== "View") {
      box = box.parent;
    }
    expect(StyleSheet.flatten(box!.props.style)?.flexDirection).not.toBe("row");
  });

  it("falls back to the placeholder image for a trail with no photo", () => {
    mockCard = { card: { ...CARD, image: undefined }, isLoading: false };
    show();

    expect(images()).toHaveLength(1);
    expect(images()[0].props.source).not.toEqual({ uri: expect.anything() });
  });

  it("renders the trail without a rating when the card never arrives", () => {
    // Offline, or a failed fetch: useTrailCard leaves card null and stops loading.
    mockCard = { card: null, isLoading: false };
    show();

    expect(screen.getByText("Kypesjön runt")).toBeTruthy();
    expect(screen.queryByText(/★/)).toBeNull();
    // The placeholder stands in, so the card is never an empty box.
    expect(images()).toHaveLength(1);
  });

  it("marks an accessible trail and leaves the badge off an inaccessible one", () => {
    show({ ...TRAIL, accessibility: true });
    expect(screen.getByTestId("icon-wheelchair-accessibility")).toBeTruthy();

    screen.unmount();
    show({ ...TRAIL, accessibility: false });
    expect(screen.queryByTestId("icon-wheelchair-accessibility")).toBeNull();
  });

  it("opens the trail from the card and from the button", () => {
    const first = show();
    fireEvent.press(screen.getByTestId("adventure-reveal-card"));
    expect(first.onOpen).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId("adventure-open"));
    expect(first.onOpen).toHaveBeenCalledTimes(2);
    expect(first.onReroll).not.toHaveBeenCalled();
  });

  it("re-rolls without opening the trail", () => {
    const { onOpen, onReroll } = show();

    fireEvent.press(screen.getByTestId("adventure-reroll"));

    expect(onReroll).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("draws its actions from the theme in both modes", () => {
    show(TRAIL, AppDefaultTheme);
    expect(screen.getByTestId("adventure-open")).toHaveStyle({
      backgroundColor: AppDefaultTheme.colors.primary,
    });

    screen.unmount();
    show(TRAIL, AppDarkTheme);
    expect(screen.getByTestId("adventure-open")).toHaveStyle({
      backgroundColor: AppDarkTheme.colors.primary,
    });
    expect(screen.getByTestId("adventure-reroll")).toHaveStyle({
      backgroundColor: AppDarkTheme.colors.surfaceVariant,
    });
  });
});
