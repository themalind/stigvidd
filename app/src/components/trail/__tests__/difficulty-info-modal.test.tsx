// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import DifficultyInfoModal from "@/components/trail/difficulty-info-modal";
import { BORDER_RADIUS } from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen, within } from "@testing-library/react-native";
import { BlurView } from "expo-blur";
import { Dimensions, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

type Theme = typeof AppDefaultTheme | typeof AppDarkTheme;

const HEIGHT = Dimensions.get("screen").height;
const TITLE = "Svårighetsgrader";

const onDismiss = jest.fn();

function show(difficulty = 2, visible = true, theme: Theme = AppDefaultTheme) {
  return renderWithProviders(<DifficultyInfoModal difficulty={difficulty} visible={visible} onDismiss={onDismiss} />, {
    theme,
  });
}

function cards() {
  return screen.getAllByTestId("difficulty-info-card");
}

function highlighted(theme: Theme = AppDefaultTheme) {
  return cards().filter((card) => StyleSheet.flatten(card.props.style).borderColor === theme.colors.primary);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("what the modal explains", () => {
  // Every level the import can assign, including the one it assigns when it cannot classify.
  it("describes all four levels", () => {
    show();

    expect(screen.getByText(TITLE)).toBeTruthy();
    expect(cards()).toHaveLength(4);
    for (const label of ["Lätt", "Medel", "Svår", "Inte klassificerad"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("spells out what each level means on the ground", () => {
    show();

    expect(screen.getByText(/möjligt att ta sig fram med barnvagn/)).toBeTruthy();
    expect(screen.getByText(/mindre vägar och naturstigar/)).toBeTruthy();
    expect(screen.getByText(/stora nivåskillnader eller branta passager/)).toBeTruthy();
    expect(screen.getByText("Ingen officiell klassificering finns.")).toBeTruthy();
  });

  it("gives each level the marker used on the trail card", () => {
    show();

    expect(within(cards()[0]).getByTestId("icon-circle")).toBeTruthy();
    expect(within(cards()[1]).getByTestId("icon-diamond")).toBeTruthy();
    expect(within(cards()[2]).getByTestId("icon-triangle")).toBeTruthy();
  });

  it("stays out of sight until it is opened", () => {
    show(2, false);

    expect(screen.queryByText(TITLE)).toBeNull();
    expect(screen.UNSAFE_queryByType(BlurView)).toBeNull();
  });
});

describe("marking the trail's own level", () => {
  it.each([
    [1, "Lätt"],
    [2, "Medel"],
    [3, "Svår"],
    [0, "Inte klassificerad"],
  ])("picks out level %i", (difficulty, label) => {
    show(difficulty);

    const marked = highlighted();
    expect(marked).toHaveLength(1);
    expect(within(marked[0]).getByText(label)).toBeTruthy();
  });

  // A level the app does not know must leave every card plain rather than guess one.
  it("marks nothing when the level is not one of the four", () => {
    show(9);

    expect(highlighted()).toHaveLength(0);
  });

  // The border alone is easy to miss on a phone in daylight, so the fill changes too.
  it("fills the marked card as well as outlining it", () => {
    show(2);

    expect(highlighted()[0]).toHaveStyle({ backgroundColor: AppDefaultTheme.colors.surfaceVariant });
    const plain = cards().filter((card) => !highlighted().includes(card));
    for (const card of plain) {
      expect(card).toHaveStyle({
        backgroundColor: AppDefaultTheme.colors.surface,
        borderColor: AppDefaultTheme.colors.outlineVariant,
      });
    }
  });

  it("marks the level in the dark theme's own colours", () => {
    show(2, true, AppDarkTheme);

    expect(highlighted(AppDarkTheme)).toHaveLength(1);
    expect(highlighted(AppDarkTheme)[0]).toHaveStyle({ backgroundColor: AppDarkTheme.colors.surfaceVariant });
  });
});

describe("closing it again", () => {
  it("closes when the close icon is pressed", async () => {
    show();

    fireEvent.press(screen.getByTestId("difficulty-info-close"));
    await settle();

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // A 20pt glyph is smaller than a finger, so the touch target is the slop around it.
  it("gives the close icon a reachable touch target", () => {
    show();

    expect(screen.getByTestId("difficulty-info-close").props.hitSlop).toBe(16);
    const close = screen.getByTestId("icon-close", { includeHiddenElements: true });
    expect(close.props.size).toBe(20);
    expect(close.props.color).toBe(AppDefaultTheme.colors.onSurface);
  });
});

describe("how the modal is drawn", () => {
  it("gives it most of the screen's height, on the theme's surface", () => {
    show();

    expect(screen.getByTestId("modal-surface-outer-layer")).toHaveStyle({ height: HEIGHT * 0.8 });
    expect(screen.getByTestId("modal-surface")).toHaveStyle({
      borderRadius: BORDER_RADIUS,
      padding: 10,
      backgroundColor: AppDefaultTheme.colors.surface,
    });
  });

  it("draws it on the dark theme's surface too", () => {
    show(2, true, AppDarkTheme);

    expect(screen.getByTestId("modal-surface")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.surface });
  });

  it("keeps the title and the way out at opposite ends of one row", () => {
    show();

    expect(screen.getByTestId("difficulty-info-header")).toHaveStyle({
      flexDirection: "row",
      justifyContent: "space-between",
      padding: 5,
    });
    expect(screen.getByText(TITLE)).toHaveStyle({ fontWeight: "700", fontSize: 16 });
  });

  // The four descriptions are longer than any phone screen, so the modal scrolls and a tap
  // reaches what is under the finger.
  it("lets the whole explanation be scrolled through", () => {
    show();

    const scroll = screen.UNSAFE_getByType(KeyboardAwareScrollView);
    expect(scroll.props.keyboardShouldPersistTaps).toBe("handled");
    expect(scroll.props.enableOnAndroid).toBe(true);
    expect(scroll.props.extraScrollHeight).toBe(20);
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({ flexGrow: 1 });
  });

  // The modal opens over a trail screen full of text, and the blur keeps that from competing.
  it("blurs the screen behind it while it is open", () => {
    show();

    const blur = screen.UNSAFE_getByType(BlurView);
    expect(blur.props.intensity).toBe(100);
    expect(blur.props.tint).toBe("dark");
    expect(StyleSheet.flatten(blur.props.style)).toMatchObject({ position: "absolute", top: 0, bottom: 0 });
  });

  it("sets the level labels as small capitals", () => {
    show();

    expect(screen.getByText("Medel")).toHaveStyle({
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    });
  });
});
