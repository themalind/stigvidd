// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AccessibilityInfoModal from "@/components/trail/accessibility-info-modal";
import { BORDER_RADIUS } from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen, within } from "@testing-library/react-native";
import { BlurView } from "expo-blur";
import { Dimensions, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Text } from "react-native-paper";

const HEIGHT = Dimensions.get("screen").height;
const TITLE = "Tillgänglighet";
const ADAPTED = "Tillgänglighetsanpassad";
const NOT_ADAPTED = "Ej tillgänglighetsanpassad";

const onDismiss = jest.fn();

function show(visible = true, theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme) {
  return renderWithProviders(<AccessibilityInfoModal visible={visible} onDismiss={onDismiss} />, { theme });
}

function icon(name: string) {
  return screen.getByTestId(`icon-${name}`, { includeHiddenElements: true });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// The modal explains what the wheelchair symbol promises, so "not adapted" belongs in it too.
it("explains both what an adapted place is and what an unadapted one is", () => {
  show();

  expect(screen.getByText(TITLE)).toBeTruthy();
  expect(screen.getByText(ADAPTED)).toBeTruthy();
  expect(screen.getByText(NOT_ADAPTED)).toBeTruthy();
  expect(screen.getAllByTestId("accessibility-info-card")).toHaveLength(2);
});

it("stays out of sight until it is opened", () => {
  show(false);

  expect(screen.queryByText(TITLE)).toBeNull();
  expect(screen.UNSAFE_queryByType(BlurView)).toBeNull();
});

it("closes when the close icon is pressed", async () => {
  show();

  fireEvent.press(screen.getByTestId("accessibility-info-close"));
  await settle();

  expect(onDismiss).toHaveBeenCalled();
});

// The descriptions are one string with blank lines, which unsplit read as a gap inside a paragraph.
it("sets each description as separate paragraphs rather than one block", () => {
  show();

  expect(screen.getByText(/^Platser som är anpassade är tillgängliga för alla/)).toBeTruthy();
  expect(screen.getByText(/^Vad som finns på plats varierar/)).toBeTruthy();
  expect(screen.getByText(/^En plats eller led som inte är tillgänglighetsanpassad/)).toBeTruthy();
  expect(screen.getByText(/^I appen hittar du information om varje enskilt besöksmål/)).toBeTruthy();
});

it("leaves no blank line, and no empty paragraph, inside a card", () => {
  show();

  for (const card of screen.getAllByTestId("accessibility-info-card")) {
    // A label and two paragraphs: unsplit it would be one Text, with the blank line an empty third.
    const lines = within(card).UNSAFE_getAllByType(Text);
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(String(line.props.children).trim()).not.toBe("");
      expect(String(line.props.children)).not.toContain("\n");
    }
  }
});

// The gap is the only thing separating two paragraphs, and the first keeps the card's padding.
it("spaces the paragraphs apart without indenting the first one", () => {
  show();

  expect(screen.getByText(/^Platser som är anpassade/)).not.toHaveStyle({ marginTop: 8 });
  expect(screen.getByText(/^Vad som finns på plats varierar/)).toHaveStyle({ marginTop: 8 });
});

it("gives each kind of place the icon that stands for it", () => {
  show();

  expect(icon("wheelchair-accessibility").props.size).toBe(24);
  expect(icon("wheelchair-accessibility").props.color).toBe(AppDefaultTheme.colors.primary);
  expect(icon("hiking")).toBeTruthy();
  // The icon leads the label on one line rather than sitting above it.
  expect(screen.getAllByTestId("accessibility-info-card-header")[0]).toHaveStyle({
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 4,
  });
});

it("marks the modal itself with the accessibility symbol", () => {
  show();

  expect(icon("human-handsup").props.size).toBe(20);
  expect(icon("human-handsup").props.color).toBe(AppDefaultTheme.colors.tertiary);
});

// The symbol sits in a ring of its own; a square would read as a button.
it("rings the accessibility symbol in the theme's own colour", () => {
  show();

  expect(screen.getByTestId("accessibility-info-symbol")).toHaveStyle({
    borderColor: AppDefaultTheme.colors.primary,
    borderWidth: 0.5,
    borderRadius: 100,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  });
});

it("keeps the title and the way out at opposite ends of one row", () => {
  show();

  expect(screen.getByTestId("accessibility-info-header")).toHaveStyle({
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 5,
  });
  // The symbol and the title travel together at the left end of that row.
  expect(screen.getByTestId("accessibility-info-header-left")).toHaveStyle({
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  });
  expect(screen.getByText(TITLE)).toHaveStyle({ fontWeight: "700", fontSize: 16 });
  // A 20pt glyph is smaller than a finger, so the touch target is the slop around it.
  expect(screen.getByTestId("accessibility-info-close").props.hitSlop).toBe(16);
  expect(icon("close").props.color).toBe(AppDefaultTheme.colors.onSurface);
  expect(icon("close").props.size).toBe(20);
});

it("gives the modal most of the screen's height, on the theme's surface", () => {
  show();

  expect(screen.getByTestId("modal-surface-outer-layer")).toHaveStyle({ height: HEIGHT * 0.8 });
  expect(screen.getByTestId("modal-surface")).toHaveStyle({
    borderRadius: BORDER_RADIUS,
    padding: 10,
    backgroundColor: AppDefaultTheme.colors.surface,
  });
});

it("draws the modal on the dark theme's surface too", () => {
  show(true, AppDarkTheme);

  expect(screen.getByTestId("modal-surface")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.surface });
});

it("sets each kind of place off as a card of its own", () => {
  show();

  for (const card of screen.getAllByTestId("accessibility-info-card")) {
    expect(card).toHaveStyle({
      borderWidth: 0.5,
      padding: 12,
      borderRadius: BORDER_RADIUS,
      gap: 8,
      borderColor: AppDefaultTheme.colors.outlineVariant,
      backgroundColor: AppDefaultTheme.colors.secondaryContainer,
    });
  }
});

it("carries the dark theme's card colours as well", () => {
  show(true, AppDarkTheme);

  for (const card of screen.getAllByTestId("accessibility-info-card")) {
    expect(card).toHaveStyle({
      borderColor: AppDarkTheme.colors.outlineVariant,
      backgroundColor: AppDarkTheme.colors.secondaryContainer,
    });
  }
});

// The label is a heading, so it is set small and in capitals; the string itself stays as written.
it("sets the card labels as small capitals", () => {
  show();

  expect(screen.getByText(ADAPTED)).toHaveStyle({
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  });
});

it("sets the descriptions in a size that carries a long read", () => {
  show();

  expect(screen.getByText(/^Platser som är anpassade/)).toHaveStyle({ fontSize: 13, lineHeight: 20 });
});

// The descriptions are longer than any phone screen, so the modal scrolls and a tap reaches what
// is under the finger.
it("lets the whole explanation be scrolled through", () => {
  show();

  const scroll = screen.UNSAFE_getByType(KeyboardAwareScrollView);
  expect(scroll.props.keyboardShouldPersistTaps).toBe("handled");
  expect(scroll.props.enableOnAndroid).toBe(true);
  // Room under whatever the keyboard would otherwise cover.
  expect(scroll.props.extraScrollHeight).toBe(20);
  expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({ flexGrow: 1 });
});

it("keeps the cards apart from each other and from the header", () => {
  show();

  // The cards are the content column's own children, so the gap between them is its.
  expect(screen.getByTestId("accessibility-info-content")).toHaveStyle({ gap: 15 });
});

// The modal opens over a trail screen full of text, and the blur keeps that from competing.
it("blurs the screen behind it while it is open", () => {
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
