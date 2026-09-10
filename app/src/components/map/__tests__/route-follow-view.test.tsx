// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import RouteFollowView from "@/components/map/route-follow-view";
import { SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { AppDefaultTheme } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const mockBack = jest.fn();
const mockUseLiveUserLocation = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, navigate: jest.fn() }),
}));

jest.mock("@/hooks/useLiveUserLocation", () => ({
  useLiveUserLocation: () => mockUseLiveUserLocation(),
}));

const PATH: GeoJSON.Position[] = [
  [12.94, 57.72],
  [12.95, 57.73],
];

// Every marker mounts its own layers, so a layer is found by the id the view gave it.
function layer(id: string) {
  return screen.queryAllByTestId("maplibre-Layer").find((node) => node.props.id === id);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLiveUserLocation.mockReturnValue(null);
});

it("draws the route as a line and marks its start", () => {
  renderWithProviders(<RouteFollowView idPrefix="hike" path={PATH} />);

  expect(layer("hike-route-line")).toBeTruthy();
  expect(layer("hike-start-point")).toBeTruthy();
  // The trailhead label is a symbol layer the map renders itself, not RN text.
  expect(layer("hike-start-label")?.props.layout["text-field"]).toBe("Start");
});

// A route still loading has no coordinates, and an empty line would put an empty source on the map.
it("draws no line and no start marker for an empty route", () => {
  renderWithProviders(<RouteFollowView idPrefix="hike" path={[]} isLoading />);

  expect(layer("hike-route-line")).toBeFalsy();
  expect(layer("hike-start-point")).toBeFalsy();
});

// One point is a real route — a recording with a single fix — and it has a trailhead but no line.
it("marks the start of a one-point route without drawing a line", () => {
  renderWithProviders(<RouteFollowView idPrefix="hike" path={[PATH[0]]} />);

  expect(layer("hike-route-line")).toBeFalsy();
  expect(layer("hike-start-point")).toBeTruthy();
});

it("goes back when the chip is pressed", () => {
  renderWithProviders(<RouteFollowView idPrefix="trail" path={PATH} title="Kvarnstigen" />);

  fireEvent.press(screen.getByLabelText("Gå tillbaka"));

  expect(mockBack).toHaveBeenCalledTimes(1);
});

// The chip grows with its title over the map's top-left corner, so a long name truncates.
it("lays the titled chip over the top-left corner and caps its width", () => {
  renderWithProviders(<RouteFollowView idPrefix="trail" path={PATH} title="En ovanligt lång ledtitel" />);

  expect(screen.getByLabelText("Gå tillbaka")).toHaveStyle({
    position: "absolute",
    top: SCREEN_PADDING,
    left: SURFACE_BORDER_RADIUS,
    maxWidth: "70%",
    borderRadius: SURFACE_BORDER_RADIUS,
    backgroundColor: AppDefaultTheme.colors.surface,
  });
  expect(screen.getByText("En ovanligt lång ledtitel").props.numberOfLines).toBe(1);
});

// Without a title the chip collapses to a square button in the same corner.
it("collapses to a square button in the same corner when there is no title", () => {
  renderWithProviders(<RouteFollowView idPrefix="trail" path={PATH} />);

  expect(screen.getByLabelText("Gå tillbaka")).toHaveStyle({
    position: "absolute",
    top: SCREEN_PADDING,
    left: SURFACE_BORDER_RADIUS,
    width: 40,
    height: 40,
    borderRadius: SURFACE_BORDER_RADIUS,
  });
});

it("shows the spinner while loading, and no error", () => {
  renderWithProviders(<RouteFollowView idPrefix="hike" path={[]} isLoading errorMessage="Kunde inte hämta rutten" />);

  expect(screen.queryByText("Kunde inte hämta rutten")).toBeNull();
});

it("shows the error on a surface once loading is over", () => {
  renderWithProviders(<RouteFollowView idPrefix="hike" path={[]} errorMessage="Kunde inte hämta rutten" />);

  expect(screen.getByText("Kunde inte hämta rutten")).toBeTruthy();
});

// The puck sits above the trailhead circle, and names an anchor layer only once it exists.
it("anchors the puck above the start label, and names no anchor before the route arrives", () => {
  mockUseLiveUserLocation.mockReturnValue({ position: [12.94, 57.72], accuracy: 8, heading: null });

  const { rerender } = renderWithProviders(<RouteFollowView idPrefix="hike" path={[]} />);
  expect(layer("hike-user-halo")?.props.afterId).toBeUndefined();

  rerender(<RouteFollowView idPrefix="hike" path={PATH} />);
  expect(layer("hike-user-halo")?.props.afterId).toBe("hike-start-label");
});

it("draws no puck until there is a fix", () => {
  renderWithProviders(<RouteFollowView idPrefix="hike" path={PATH} />);

  expect(layer("hike-user-dot")).toBeFalsy();
});
