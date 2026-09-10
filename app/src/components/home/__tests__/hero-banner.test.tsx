// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import HeroBanner from "@/components/home/hero-banner";
import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { screen, within } from "@testing-library/react-native";

const mockWeather = jest.fn();
const mockCityName = jest.fn();

// SMHI and the device geocoder are queries of their own; the banner owns how it dresses their answers.
jest.mock("@/hooks/useWeather", () => ({ useWeather: (lat?: number, lon?: number) => mockWeather(lat, lon) }));
jest.mock("@/hooks/useCityName", () => ({ useCityName: (lat?: number, lon?: number) => mockCityName(lat, lon) }));

const LAT = 57.72;
const LON = 12.94;

let hours: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  hours = jest.spyOn(Date.prototype, "getHours").mockReturnValue(12);
  mockWeather.mockReturnValue({ data: { temperature: 14, symbolCode: 1 } });
  mockCityName.mockReturnValue({ data: "Borås", isPending: false });
});

afterEach(() => {
  hours.mockRestore();
});

function show(theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme, coords = true) {
  return renderWithProviders(coords ? <HeroBanner lat={LAT} lon={LON} /> : <HeroBanner />, { theme });
}

function atHour(hour: number) {
  hours.mockReturnValue(hour);
}

function weatherIs(symbolCode: number, temperature = 14) {
  mockWeather.mockReturnValue({ data: { temperature, symbolCode } });
}

function banner() {
  return screen.getByTestId("hero-banner");
}

it("greets the walker by the hour, and asks them out", () => {
  atHour(7);
  show();

  expect(screen.getByText("God morgon!")).toBeTruthy();
  expect(screen.getByText("Dags för en promenad?")).toBeTruthy();
});

// The four greetings meet at 5, 10, 18 and 22, and each boundary belongs to the greeting starting there.
it.each([
  [4, "God natt!"],
  [5, "God morgon!"],
  [9, "God morgon!"],
  [10, "Hej!"],
  [17, "Hej!"],
  [18, "God kväll!"],
  [21, "God kväll!"],
  [22, "God natt!"],
  [0, "God natt!"],
])("greets at %i with %s", (hour, greeting) => {
  atHour(hour);
  show();

  expect(screen.getByText(greeting)).toBeTruthy();
});

it("asks the forecast and the geocoder about the position it was given", () => {
  show();

  expect(mockWeather).toHaveBeenCalledWith(LAT, LON);
  expect(mockCityName).toHaveBeenCalledWith(LAT, LON);
});

it("shows the temperature in whole degrees beside its symbol", () => {
  weatherIs(1, 14);
  show();

  expect(screen.getByText("14°")).toBeTruthy();
  expect(within(screen.getByTestId("hero-banner-weather")).getByTestId("icon-sunny")).toBeTruthy();
});

it("shows a temperature below freezing as it is", () => {
  weatherIs(17, -3);
  show();

  expect(screen.getByText("-3°")).toBeTruthy();
});

// SMHI's symbol codes run 1-27; each band gets the icon that says what to wear.
it.each([
  [1, "icon-sunny"],
  [2, "icon-partly-sunny"],
  [3, "icon-partly-sunny"],
  [4, "icon-cloudy"],
  [6, "icon-cloudy"],
  [7, "icon-cloud"],
  [8, "icon-rainy"],
  [11, "icon-thunderstorm"],
  [14, "icon-rainy"],
  [15, "icon-snow"],
  [17, "icon-snow"],
  [18, "icon-rainy"],
  [21, "icon-thunderstorm"],
  [24, "icon-rainy"],
  [25, "icon-snow"],
  [27, "icon-snow"],
])("draws symbol %i as %s", (code, icon) => {
  weatherIs(code);
  show();

  expect(screen.getByTestId(icon)).toBeTruthy();
  expect(screen.getByTestId(icon).props.size).toBe(30);
});

// The card is tinted by the weather, so it reads before the numbers do.
it.each([
  [1, "primaryContainer", "primary"],
  [2, "secondaryContainer", "secondary"],
  [3, "secondaryContainer", "secondary"],
  [6, "surfaceVariant", "onSurfaceVariant"],
  [11, "tertiaryContainer", "tertiary"],
  [16, "tertiaryContainer", "tertiary"],
  [21, "tertiaryContainer", "tertiary"],
  [26, "tertiaryContainer", "tertiary"],
  [8, "surfaceVariant", "onSurfaceVariant"],
  [7, "surfaceVariant", "onSurfaceVariant"],
] as const)("tints the card for symbol %i", (code, tint, accent) => {
  weatherIs(code);
  show();

  expect(banner()).toHaveStyle({ backgroundColor: AppDefaultTheme.colors[tint] });
  expect(screen.getByTestId("icon-location-pin").props.color).toBe(AppDefaultTheme.colors[accent]);
});

it("stays on the plain surface until the forecast arrives", () => {
  mockWeather.mockReturnValue({ data: undefined });
  show();

  expect(banner()).toHaveStyle({ backgroundColor: AppDefaultTheme.colors.surfaceVariant });
  expect(screen.queryByTestId("hero-banner-weather")).toBeNull();
  expect(screen.getByTestId("icon-location-pin").props.color).toBe(AppDefaultTheme.colors.onSurfaceVariant);
});

it("names the place the walker is standing in", () => {
  mockCityName.mockReturnValue({ data: "Borås", isPending: false });
  show();

  expect(screen.getByText("Borås")).toBeTruthy();
  expect(screen.getByTestId("icon-location-pin").props.size).toBe(15);
});

// A pin with nothing beside it would read as a broken row; the whole row waits instead.
it("leaves the pin out while the geocoder is still working", () => {
  mockCityName.mockReturnValue({ data: undefined, isPending: true });
  show();

  expect(screen.queryByTestId("hero-banner-location")).toBeNull();
  expect(screen.queryByText("Plats okänd")).toBeNull();
});

it("says the place is unknown once the geocoder has given up", () => {
  mockCityName.mockReturnValue({ data: null, isPending: false });
  show();

  expect(screen.getByText("Plats okänd")).toBeTruthy();
});

// Without a position there is nothing to wait for, and one line covers the missing weather too.
it("says the place is unknown straight away when there is no position", () => {
  mockWeather.mockReturnValue({ data: undefined });
  mockCityName.mockReturnValue({ data: undefined, isPending: true });
  show(AppDefaultTheme, false);

  expect(screen.getByText("Plats okänd")).toBeTruthy();
  expect(mockWeather).toHaveBeenCalledWith(undefined, undefined);
});

// Half a position is no position: the geocoder is never asked, so nothing waits for it.
it("says the place is unknown when only one half of the position arrived", () => {
  mockCityName.mockReturnValue({ data: undefined, isPending: true });
  renderWithProviders(<HeroBanner lat={LAT} />);

  expect(screen.getByText("Plats okänd")).toBeTruthy();
});

it("lays the greeting and the weather out on opposite sides of the card", () => {
  show();

  expect(banner()).toHaveStyle({
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: SURFACE_BORDER_RADIUS,
    paddingVertical: 20,
    paddingHorizontal: 18,
    marginTop: 12,
    marginHorizontal: 12,
  });
});

// The greeting takes the room that is left, so a long place name never pushes it out of the card.
it("gives the greeting the width the weather does not need", () => {
  show();

  expect(screen.getByTestId("hero-banner-text")).toHaveStyle({ flex: 1, gap: 6 });
});

it("stacks the temperature over the place name", () => {
  show();

  expect(screen.getByTestId("hero-banner-aside")).toHaveStyle({
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  });
  expect(screen.getByTestId("hero-banner-weather")).toHaveStyle({
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  });
  expect(screen.getByTestId("hero-banner-location")).toHaveStyle({
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  });
});

it("sets the greeting largest, then the temperature, then the invitation", () => {
  atHour(12);
  show();

  expect(screen.getByText("Hej!")).toHaveStyle({
    fontSize: 22,
    fontWeight: "700",
    color: AppDefaultTheme.colors.onSurface,
  });
  expect(screen.getByText("14°")).toHaveStyle({
    fontSize: 20,
    fontWeight: "600",
    color: AppDefaultTheme.colors.onSurface,
  });
  expect(screen.getByText("Dags för en promenad?")).toHaveStyle({
    fontSize: 13,
    color: AppDefaultTheme.colors.onSurfaceVariant,
  });
});

it("carries the dark theme's colours too", () => {
  atHour(12);
  show(AppDarkTheme);

  expect(banner()).toHaveStyle({ backgroundColor: AppDarkTheme.colors.primaryContainer });
  expect(screen.getByText("Hej!")).toHaveStyle({ color: AppDarkTheme.colors.onSurface });
  expect(screen.getByText("Borås")).toHaveStyle({ color: AppDarkTheme.colors.onSurface });
  expect(screen.getByTestId("icon-sunny").props.color).toBe(AppDarkTheme.colors.primary);
});
