// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import GetStartedCard from "@/components/home/get-started-card";
import { OVERLAY_TEXT_SHADOW, SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { renderWithProviders } from "@/test/render";
import { buildDecorativeRoute } from "@/utils/decorative-route";
import { fireEvent, screen } from "@testing-library/react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Dimensions, StyleSheet } from "react-native";
import { Button } from "react-native-paper";
import Svg, { Circle, Path } from "react-native-svg";

const mockNavigate = jest.fn();

jest.mock("expo-router", () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
}));

const SIGNED_OUT_TITLE = "Din nästa promenad börjar här";
const SIGNED_IN_TITLE = "Redo för din första promenad?";
const SIGNED_OUT_ACTION = "Logga in";
const SIGNED_IN_ACTION = "Spela in en promenad";

const CARD_WIDTH = Dimensions.get("window").width - SCREEN_PADDING * 2;
const ROUTE_BAND_HEIGHT = 108;

// guardedNavigate debounces on module state for 500 ms, so every press needs a clock that has moved on.
let clock = 6_000_000;

function show(signedIn = false) {
  return renderWithProviders(<GetStartedCard signedIn={signedIn} />);
}

function press(label: string) {
  fireEvent.press(screen.getByText(label));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

// The card stands in for the latest-hike card, telling a signed-out visitor what the app does.
it("pitches the app to someone who is not signed in", () => {
  show();

  expect(screen.getByText(SIGNED_OUT_TITLE)).toBeTruthy();
  expect(
    screen.getByText("Logga in för att spela in dina turer med GPS, se rutten på kartan och spara dem du vill gå om."),
  ).toBeTruthy();
  expect(screen.getByText(SIGNED_OUT_ACTION)).toBeTruthy();
});

it("asks a signed-in user with no walks to record one", () => {
  show(true);

  expect(screen.getByText(SIGNED_IN_TITLE)).toBeTruthy();
  expect(
    screen.getByText(
      "Starta inspelningen när du går – Stigvidd ritar din väg på kartan, räknar sträckan och sparar turen åt dig.",
    ),
  ).toBeTruthy();
  expect(screen.getByText(SIGNED_IN_ACTION)).toBeTruthy();
  expect(screen.queryByText(SIGNED_OUT_TITLE)).toBeNull();
});

it("sends someone who is not signed in to the login screen", () => {
  show();

  press(SIGNED_OUT_ACTION);

  expect(mockNavigate).toHaveBeenCalledWith("/(tabs)/(profile-stack)/login");
});

it("sends a signed-in user straight to recording", () => {
  show(true);

  press(SIGNED_IN_ACTION);

  expect(mockNavigate).toHaveBeenCalledWith("/(tabs)/(profile-stack)/user/create-hike");
});

// A second tap while the screen is still there must not push a second copy of it.
it("opens the screen once however fast the button is pressed twice", () => {
  jest.spyOn(Date, "now").mockReturnValue((clock += 10_000));
  show(true);

  press(SIGNED_IN_ACTION);
  press(SIGNED_IN_ACTION);

  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

it("carries the icon of the action it offers", () => {
  show(true);
  expect(screen.UNSAFE_getByType(Button).props.icon).toBe("record-circle-outline");

  screen.unmount();
  show();
  expect(screen.UNSAFE_getByType(Button).props.icon).toBe("login");
});

it("keeps the card a fixed height inside the screen's margins", () => {
  show();

  expect(screen.getByTestId("get-started-card")).toHaveStyle({
    height: 240,
    marginHorizontal: SCREEN_PADDING,
    borderRadius: SURFACE_BORDER_RADIUS,
    overflow: "hidden",
    justifyContent: "flex-end",
  });
});

// A portrait photo in a landscape card: cover takes a horizontal slice from the middle.
it("fills the card with the photograph", () => {
  show();

  const image = screen.UNSAFE_getByType(Image);
  expect(image.props.contentFit).toBe("cover");
  expect(image.props.contentPosition).toBe("center");
  expect(StyleSheet.flatten(image.props.style)).toMatchObject({ position: "absolute", top: 0, bottom: 0 });
});

// The words sit on a photograph; the gradient runs clear at the top to near-solid under the text.
it("darkens the photograph from the bottom up", () => {
  show();

  const gradient = screen.UNSAFE_getByType(LinearGradient);
  expect(gradient.props.colors).toEqual([
    "rgba(0,0,0,0)",
    "rgba(0,0,0,0.05)",
    "rgba(0,0,0,0.45)",
    "rgba(0,0,0,0.82)",
    "rgba(0,0,0,0.94)",
  ]);
  expect(gradient.props.locations).toEqual([0, 0.35, 0.55, 0.72, 1]);
  expect(StyleSheet.flatten(gradient.props.style)).toMatchObject({ position: "absolute", top: 0, bottom: 0 });
});

it("draws the route across the top of the card, out of the way of a tap", () => {
  show();

  expect(screen.getByTestId("get-started-route")).toHaveStyle({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: ROUTE_BAND_HEIGHT,
  });
  expect(screen.getByTestId("get-started-route").props.pointerEvents).toBe("none");
});

it("gives the route the full width of the card to wander across", () => {
  show();

  const svg = screen.UNSAFE_getByType(Svg);
  expect(svg.props.width).toBe(CARD_WIDTH);
  expect(svg.props.height).toBe(ROUTE_BAND_HEIGHT);
});

// The route is generated, not a real walk: the shape the util hands out for this card's width.
it("draws the generated route rather than a map", () => {
  show();

  const route = buildDecorativeRoute(CARD_WIDTH, ROUTE_BAND_HEIGHT);
  for (const path of screen.UNSAFE_getAllByType(Path)) {
    expect(path.props.d).toBe(route.d);
    expect(path.props.strokeDasharray).toBe(route.length);
    expect(path.props.fill).toBe("none");
  }
  expect(screen.queryByTestId("maplibre-Map")).toBeNull();
});

// A white line alone disappears against sky, so it is drawn twice: a dark halo under a thinner white line.
it("gives the white line a dark halo so it reads over any photograph", () => {
  show();

  const [halo, line] = screen.UNSAFE_getAllByType(Path);
  expect(halo.props.stroke).toBe("rgba(0,0,0,0.35)");
  expect(halo.props.strokeWidth).toBe(7);
  expect(line.props.stroke).toBe("#ffffff");
  expect(line.props.strokeWidth).toBe(3);
  expect(line.props.strokeLinecap).toBe("round");
});

it("marks where the route starts", () => {
  show();

  const route = buildDecorativeRoute(CARD_WIDTH, ROUTE_BAND_HEIGHT);
  const marker = screen.UNSAFE_getByType(Circle);
  expect(marker.props.cx).toBe(route.start[0]);
  expect(marker.props.cy).toBe(route.start[1]);
  expect(marker.props.r).toBe(5);
  expect(marker.props.fill).toBe("#ffffff");
});

// The route is drawn with a dash as long as the whole path, offset by its full length, so it walks itself in.
it("starts with the route undrawn, so it appears to be walked in", () => {
  show();

  const route = buildDecorativeRoute(CARD_WIDTH, ROUTE_BAND_HEIGHT);
  for (const path of screen.UNSAFE_getAllByType(Path)) {
    expect(path.props.strokeDashoffset).toBe(route.length);
  }
});

it("sets the words in from the card's edges, one under the other", () => {
  show();

  expect(screen.getByTestId("get-started-content")).toHaveStyle({ padding: 14, gap: 5 });
});

it("sets the words in white over the darkened half of the photograph", () => {
  show();

  expect(screen.getByText(SIGNED_OUT_TITLE)).toHaveStyle({
    color: "#ffffff",
    fontSize: 19,
    fontFamily: "Inter_600SemiBold",
    ...OVERLAY_TEXT_SHADOW,
  });
  expect(
    screen.getByText("Logga in för att spela in dina turer med GPS, se rutten på kartan och spara dem du vill gå om."),
  ).toHaveStyle({ color: "#ffffff", fontSize: 13, lineHeight: 18, ...OVERLAY_TEXT_SHADOW });
});

it("keeps the button at its own width under the text", () => {
  show();

  expect(StyleSheet.flatten(screen.UNSAFE_getByType(Button).props.style)).toMatchObject({
    alignSelf: "flex-start",
    marginTop: 8,
  });
});
