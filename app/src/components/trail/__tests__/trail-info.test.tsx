// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import TrailInfo from "@/components/trail/trail-info";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { Trail } from "@/data/types";
import { flushUntilGone, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { Image } from "expo-image";
import { StyleSheet } from "react-native";

type Theme = typeof AppDefaultTheme | typeof AppDarkTheme;

const SYMBOL_URL = "https://media.stigvidd.se/symbols/bla-trekant.png";

const TRAIL = {
  identifier: "t1",
  name: "Knalleleden",
  trailSymbol: "Blå",
  trailLength: 8.5,
  classification: 2,
  accessibility: false,
  accessibilityInfo: "Kuperad terräng med rötter",
  description: "En fin led",
} as Trail;

function show(overrides: Partial<Trail> = {}, theme: Theme = AppDefaultTheme) {
  return renderWithProviders(<TrailInfo trail={{ ...TRAIL, ...overrides }} />, { theme });
}

describe("what the panel states about the trail", () => {
  it("names every field it shows", () => {
    show();

    for (const label of ["Information", "Markering", "Längd", "Svårighetsgrad", "Tillgänglighet", "Variation"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("shows the trail's own marking and variation text", () => {
    show();

    expect(screen.getByText("Blå")).toBeTruthy();
    expect(screen.getByText("Kuperad terräng med rötter")).toBeTruthy();
  });

  // The API sends a number; the unit belongs to the screen, not to the data.
  it("gives the length its unit", () => {
    show();

    expect(screen.getByText("8.5 km")).toBeTruthy();
  });

  it.each([
    [1, "Lätt"],
    [2, "Medel"],
    [3, "Svår"],
    [0, "Inte klassificerad"],
  ])("spells classification %i out as %s", (classification, expected) => {
    show({ classification });

    expect(screen.getByText(expected)).toBeTruthy();
  });

  // Anything the import has not classified must read as unknown rather than as easy.
  it("treats an unexpected classification as unclassified", () => {
    show({ classification: 9 });

    expect(screen.getByText("Inte klassificerad")).toBeTruthy();
  });

  it.each([
    [true, "Anpassad"],
    [false, "Ej anpassad"],
  ])("says %s accessibility as %s", (accessibility, expected) => {
    show({ accessibility });

    expect(screen.getByText(expected)).toBeTruthy();
  });
});

describe("the explanations behind the info icons", () => {
  it("keeps them all closed until asked for", () => {
    show({ trailSymbolImage: SYMBOL_URL });

    expect(screen.queryByText("Svårighetsgrader")).toBeNull();
    expect(screen.queryByTestId("difficulty-info-card")).toBeNull();
    expect(screen.queryByTestId("accessibility-info-card")).toBeNull();
    expect(screen.queryByTestId("symbol-info-image-frame")).toBeNull();
  });

  it("opens the difficulty explanation", async () => {
    show();

    fireEvent.press(screen.getByTestId("trail-info-difficulty-help"));
    await settle();

    expect(screen.getByText("Svårighetsgrader")).toBeTruthy();
  });

  it("offers no symbol explanation for a trail with no symbol image", () => {
    show();

    expect(screen.queryByTestId("trail-info-symbol-help")).toBeNull();
  });

  it("opens the symbol explanation", async () => {
    show({ trailSymbolImage: SYMBOL_URL });

    fireEvent.press(screen.getByTestId("trail-info-symbol-help"));
    await settle();

    expect(screen.getByText("Ledmarkering")).toBeTruthy();
    expect(screen.UNSAFE_getByType(Image).props.source).toBe(SYMBOL_URL);
  });

  it("opens the accessibility explanation", async () => {
    show();

    fireEvent.press(screen.getByTestId("trail-info-accessibility-help"));
    await settle();

    expect(screen.getAllByTestId("accessibility-info-card")).toHaveLength(2);
  });

  // One icon must not open the other panel.
  it("opens only the one that was asked for", async () => {
    show();

    fireEvent.press(screen.getByTestId("trail-info-difficulty-help"));
    await settle();

    expect(screen.queryByTestId("accessibility-info-card")).toBeNull();
  });

  it("closes the difficulty explanation again", async () => {
    show();

    fireEvent.press(screen.getByTestId("trail-info-difficulty-help"));
    await settle();
    fireEvent.press(screen.getByTestId("difficulty-info-close"));
    await flushUntilGone(() => screen.queryByText("Svårighetsgrader"));

    expect(screen.queryByText("Svårighetsgrader")).toBeNull();
  });

  // The trail's own level is what the explanation is opened to check.
  it("marks the trail's own level in the explanation it opens", async () => {
    show({ classification: 3 });

    fireEvent.press(screen.getByTestId("trail-info-difficulty-help"));
    await settle();

    const cards = screen.getAllByTestId("difficulty-info-card");
    const highlighted = cards.filter(
      (card) => StyleSheet.flatten(card.props.style).borderColor === AppDefaultTheme.colors.primary,
    );
    expect(highlighted).toHaveLength(1);
  });

  // A 17pt glyph is smaller than a finger, so the touch target is the slop around it.
  it("gives each info icon a reachable touch target", () => {
    show({ trailSymbolImage: SYMBOL_URL });

    expect(screen.getByTestId("trail-info-difficulty-help").props.hitSlop).toBe(16);
    expect(screen.getByTestId("trail-info-accessibility-help").props.hitSlop).toBe(16);
    expect(screen.getByTestId("trail-info-symbol-help").props.hitSlop).toBe(16);
  });
});

describe("how the panel is drawn", () => {
  it("sits on the theme's surface", () => {
    show();

    expect(screen.getByTestId("trail-info")).toHaveStyle({ backgroundColor: AppDefaultTheme.colors.surface });
  });

  it("follows the dark theme too", () => {
    show({}, AppDarkTheme);

    expect(screen.getByTestId("trail-info")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.surface });
  });

  // Labels are headings above their values, set small and in capitals.
  it("sets the field labels as small capitals", () => {
    show();

    expect(screen.getByText("Markering")).toHaveStyle({
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      fontWeight: "600",
    });
  });
});
