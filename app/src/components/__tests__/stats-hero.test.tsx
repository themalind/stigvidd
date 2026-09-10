// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import StatsHero, { HeroSatellite } from "@/components/stats-hero";
import { SCREEN_PADDING } from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";
import { Text } from "react-native";

const SATELLITES: HeroSatellite[] = [
  { icon: "walk", value: "12", label: "promenader" },
  { icon: "clock-outline", value: "4 h", label: "i rörelse" },
];

function show(
  {
    figure = "142 km",
    label = "totalt gått",
    satellites = SATELLITES,
  }: { figure?: string; label?: string; satellites?: HeroSatellite[] } = {},
  theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme,
) {
  return renderWithProviders(<StatsHero figure={figure} label={label} satellites={satellites} />, { theme });
}

// An empty <Text /> is invisible to every query but still takes a gap on a device.
function emptyTexts() {
  return screen.UNSAFE_queryAllByType(Text).filter((node) => {
    const children = node.props.children;
    return children === "" || (Array.isArray(children) && children.length === 0);
  });
}

// The unit is set smaller than the number, so it has to be its own Text.
it("sets the unit apart from the figure", () => {
  show();

  expect(screen.getByText("142")).toBeTruthy();
  expect(screen.getByText("km")).toBeTruthy();
  expect(screen.getByText("142")).toHaveStyle({ fontSize: 40, lineHeight: 46 });
  expect(screen.getByText("km")).toHaveStyle({ fontSize: 18 });
});

// Only the last space splits, so a figure like "1 234 km" keeps its thousands separator.
it("splits only the trailing unit off a grouped number", () => {
  show({ figure: "1 234 km" });

  expect(screen.getByText("1 234")).toBeTruthy();
  expect(screen.getByText("km")).toBeTruthy();
});

it("shows a figure that carries no unit, and no empty line where one would be", () => {
  show({ figure: "7", satellites: [] });

  expect(screen.getByText("7")).toBeTruthy();
  expect(emptyTexts()).toHaveLength(0);
});

it("labels the figure", () => {
  show();

  expect(screen.getByText("totalt gått")).toHaveStyle({ textTransform: "uppercase", letterSpacing: 1 });
});

it("shows every satellite with its icon", () => {
  show();

  expect(screen.getByText("12")).toBeTruthy();
  expect(screen.getByText("promenader")).toBeTruthy();
  expect(screen.getByText("4 h")).toBeTruthy();
  expect(screen.getByText("i rörelse")).toBeTruthy();
  expect(screen.getByTestId("icon-walk")).toBeTruthy();
  expect(screen.getByTestId("icon-clock-outline")).toBeTruthy();
});

// "12 promenader" reads one way round and "flest från Olof" the other.
it("puts the value first by default", () => {
  show({ satellites: [{ icon: "walk", value: "12", label: "promenader" }] });

  expect(screen.getByTestId("stats-hero-satellite-0")).toHaveTextContent("12promenader");
});

it("puts the label first when the phrase reads that way", () => {
  show({ satellites: [{ icon: "account", value: "Olof", label: "flest från", labelFirst: true }] });

  expect(screen.getByTestId("stats-hero-satellite-0")).toHaveTextContent("flest frånOlof");
});

// The rule sits between two satellites, so a lone one must not get a leading rule.
it("rules between the satellites, not before the first", () => {
  show();

  expect(screen.getAllByTestId("stats-hero-separator")).toHaveLength(1);
});

it("draws no rule for a single satellite", () => {
  show({ satellites: [SATELLITES[0]] });

  expect(screen.queryByTestId("stats-hero-separator")).toBeNull();
});

it("still draws the figure when there are no satellites at all", () => {
  show({ satellites: [] });

  expect(screen.getByText("142")).toBeTruthy();
  expect(screen.queryByTestId("stats-hero-separator")).toBeNull();
});

// A twenty-character nickname truncates rather than pushing its neighbour off the row.
it("keeps a long satellite on one line", () => {
  show({ satellites: [{ icon: "account", value: "Olof Långnamnsson", label: "flest från", labelFirst: true }] });

  expect(screen.getByText("Olof Långnamnsson").props.numberOfLines).toBe(1);
  expect(screen.getByText("Olof Långnamnsson")).toHaveStyle({ flexShrink: 1 });
});

it("sits on the light theme's container colour", () => {
  show();

  expect(screen.getByTestId("stats-hero-card")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.secondaryContainer,
  });
  expect(screen.getByText("142")).toHaveStyle({ color: AppDefaultTheme.colors.onSecondaryContainer });
});

// The dark theme's container colour is too close to the page behind it to read as a card.
it("swaps to the surface variant in the dark theme", () => {
  show({}, AppDarkTheme);

  expect(screen.getByTestId("stats-hero-card")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.surfaceVariant });
  expect(screen.getByText("142")).toHaveStyle({ color: AppDarkTheme.colors.onSurface });
});

// The banner is drawn inside a padded screen but has to reach both edges.
it("breaks out of the screen's padding, and clips what it draws", () => {
  show();

  expect(screen.getByTestId("stats-hero-card")).toHaveStyle({
    marginHorizontal: -SCREEN_PADDING,
    overflow: "hidden",
  });
});

// The lane gives back the content padding to span the card, and lifts into the headroom under the label.
it("spans the route lane across the card, tucked under the label", () => {
  show();

  expect(screen.getByTestId("stats-hero-route")).toHaveStyle({
    height: 68,
    marginTop: -25,
    marginHorizontal: -(SCREEN_PADDING + 10),
  });
});
