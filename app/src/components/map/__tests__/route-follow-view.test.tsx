// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { MAP_FADE_MS } from "@/components/map/map";
import RouteFollowView, { type FollowObstacles } from "@/components/map/route-follow-view";
import { SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { AppDefaultTheme } from "@/constants/theme";
import { TrailObstacle } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Animated, Dimensions } from "react-native";

const mockBack = jest.fn();
const mockUseLiveUserLocation = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, navigate: jest.fn() }),
}));

jest.mock("@/hooks/location/useLiveUserLocation", () => ({
  useLiveUserLocation: () => mockUseLiveUserLocation(),
}));

// keep-comment: the card has its own suite; here it only shows which obstacle it was mounted for
jest.mock("@/components/trail/obstacle/obstacle-map-card", () => {
  const { Text } = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  function MockObstacleMapCard({
    obstacle,
    trailIdentifier,
  }: {
    obstacle: { identifier: string };
    trailIdentifier: string;
  }) {
    const [mountedFor] = ReactActual.useState(obstacle.identifier);
    return ReactActual.createElement(
      Text,
      { testID: `obstacle-card-${obstacle.identifier}` },
      `${trailIdentifier}:${obstacle.identifier} mounted for ${mountedFor}`,
    );
  }
  return { __esModule: true, default: MockObstacleMapCard };
});

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

it("edges the route line in white, underneath it", async () => {
  await renderWithProviders(<RouteFollowView idPrefix="hike" path={PATH} />);

  const ids = screen.queryAllByTestId("maplibre-Layer").map((node) => node.props.id);
  expect(ids.indexOf("hike-route-line-casing")).toBeGreaterThan(-1);
  expect(ids.indexOf("hike-route-line-casing")).toBeLessThan(ids.indexOf("hike-route-line"));
  expect(layer("hike-route-line-casing")?.props.paint).toEqual({ "line-color": "rgb(255, 255, 255)", "line-width": 8 });
});

it("draws the route as a line and marks its start", async () => {
  await renderWithProviders(<RouteFollowView idPrefix="hike" path={PATH} />);

  expect(layer("hike-route-line")).toBeTruthy();
  expect(layer("hike-start-point")).toBeTruthy();
  // The trailhead label is a symbol layer the map renders itself, not RN text.
  expect(layer("hike-start-label")?.props.layout["text-field"]).toBe("Start");
});

// A route still loading has no coordinates, and an empty line would put an empty source on the map.
it("draws no line and no start marker for an empty route", async () => {
  await renderWithProviders(<RouteFollowView idPrefix="hike" path={[]} isLoading />);

  expect(layer("hike-route-line")).toBeFalsy();
  expect(layer("hike-start-point")).toBeFalsy();
});

it("keeps the map covered while the route loads, so its jump to the route is not seen", async () => {
  const timing = jest.spyOn(Animated, "timing");
  const coverFades = () =>
    timing.mock.calls.filter(([, config]) => config.toValue === 0 && config.duration === MAP_FADE_MS);
  const rendered = () => screen.getByTestId("maplibre-Map").props.onDidFinishRenderingMapFully();
  try {
    const { rerender } = await renderWithProviders(<RouteFollowView idPrefix="hike" path={[]} isLoading />);
    await act(async () => rendered());
    expect(coverFades()).toHaveLength(0);

    await rerender(<RouteFollowView idPrefix="hike" path={PATH} />);
    await act(async () => rendered());

    expect(coverFades()).toHaveLength(1);
  } finally {
    timing.mockRestore();
  }
});

// One point is a real route — a recording with a single fix — and it has a trailhead but no line.
it("marks the start of a one-point route without drawing a line", async () => {
  await renderWithProviders(<RouteFollowView idPrefix="hike" path={PATH.slice(0, 1)} />);

  expect(layer("hike-route-line")).toBeFalsy();
  expect(layer("hike-start-point")).toBeTruthy();
});

it("opens on the route instead of jumping there once the map has loaded", async () => {
  await renderWithProviders(<RouteFollowView idPrefix="hike" path={PATH} />);

  expect(screen.getByTestId("maplibre-Camera").props.initialViewState).toEqual({
    bounds: [12.94, 57.72, 12.95, 57.73],
    padding: { top: 100, right: 60, bottom: 120, left: 60 },
  });
});

it("goes back when the chip is pressed", async () => {
  await renderWithProviders(<RouteFollowView idPrefix="trail" path={PATH} title="Kvarnstigen" />);

  await fireEvent.press(screen.getByLabelText("Gå tillbaka"));

  expect(mockBack).toHaveBeenCalledTimes(1);
});

// The chip grows with its title over the map's top-left corner, so a long name truncates.
it("lays the titled chip over the top-left corner and caps its width", async () => {
  await renderWithProviders(<RouteFollowView idPrefix="trail" path={PATH} title="En ovanligt lång ledtitel" />);

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
it("collapses to a square button in the same corner when there is no title", async () => {
  await renderWithProviders(<RouteFollowView idPrefix="trail" path={PATH} />);

  expect(screen.getByLabelText("Gå tillbaka")).toHaveStyle({
    position: "absolute",
    top: SCREEN_PADDING,
    left: SURFACE_BORDER_RADIUS,
    width: 40,
    height: 40,
    borderRadius: SURFACE_BORDER_RADIUS,
  });
});

it("shows the spinner while loading, and no error", async () => {
  await renderWithProviders(
    <RouteFollowView idPrefix="hike" path={[]} isLoading errorMessage="Kunde inte hämta rutten" />,
  );

  expect(screen.getByTestId("map-loading-spinner")).toBeTruthy();
  expect(screen.queryByText("Kunde inte hämta rutten")).toBeNull();
});

it("shows the error on a surface once loading is over", async () => {
  await renderWithProviders(<RouteFollowView idPrefix="hike" path={[]} errorMessage="Kunde inte hämta rutten" />);

  expect(screen.getByText("Kunde inte hämta rutten")).toBeTruthy();
});

// The puck sits above the trailhead circle, and names an anchor layer only once it exists.
it("anchors the puck above the start label, and names no anchor before the route arrives", async () => {
  mockUseLiveUserLocation.mockReturnValue({ position: [12.94, 57.72], accuracy: 8, heading: null });

  const { rerender } = await renderWithProviders(<RouteFollowView idPrefix="hike" path={[]} />);
  expect(layer("hike-user-halo")?.props.afterId).toBeUndefined();

  await rerender(<RouteFollowView idPrefix="hike" path={PATH} />);
  expect(layer("hike-user-halo")?.props.afterId).toBe("hike-start-label");
});

it("draws no puck until there is a fix", async () => {
  await renderWithProviders(<RouteFollowView idPrefix="hike" path={PATH} />);

  expect(layer("hike-user-dot")).toBeFalsy();
});

describe("obstacles", () => {
  function obstacle(identifier: string): TrailObstacle {
    return {
      identifier,
      userIdentifier: null,
      description: "Gran över stigen",
      issueType: "FallenTree",
      incidentLongitude: 12.94,
      incidentLatitude: 57.72,
      createdAt: "2026-11-14T10:00:00Z",
    };
  }

  function obstacles(...identifiers: string[]): FollowObstacles {
    return { trailIdentifier: "trail-1", items: identifiers.map(obstacle) };
  }

  function obstacleSource() {
    const node = screen.queryAllByTestId("maplibre-GeoJSONSource").find((n) => n.props.id === "trail-obstacles");
    if (!node) throw new Error("expected the obstacle source");
    return node;
  }

  async function tapObstacles(...identifiers: string[]) {
    await fireEvent(obstacleSource(), "press", {
      nativeEvent: { features: identifiers.map((identifier) => ({ type: "Feature", properties: { identifier } })) },
      stopPropagation: () => {},
    });
  }

  async function swipeToCard(index: number) {
    const cardWidth = Dimensions.get("window").width - SCREEN_PADDING * 2 - 44;
    await fireEvent(screen.getByTestId("obstacle-carousel-list"), "momentumScrollEnd", {
      nativeEvent: {
        contentOffset: { x: index * (cardWidth + SCREEN_PADDING) },
        contentSize: {},
        layoutMeasurement: {},
      },
    });
  }

  async function measureCarousel(height: number) {
    await fireEvent(screen.getByTestId("obstacle-carousel"), "layout", { nativeEvent: { layout: { height } } });
  }

  function enlargedPin() {
    const size = layer("trail-obstacles-pins")?.props.layout["icon-size"];
    return size[1][2];
  }

  function attribution() {
    return screen.getByTestId("maplibre-Map").props.attributionPosition;
  }

  it("draws no obstacles on a route that is given none", async () => {
    await renderWithProviders(<RouteFollowView idPrefix="hike" path={PATH} />);

    expect(layer("hike-obstacles-pins")).toBeFalsy();
  });

  it("puts the pins directly above the route line, so the start marker and puck stay on top", async () => {
    const { rerender } = await renderWithProviders(
      <RouteFollowView idPrefix="trail" path={[]} obstacles={obstacles("o1")} />,
    );
    expect(layer("trail-obstacles-hit")?.props.afterId).toBeUndefined();

    await rerender(<RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles("o1")} />);

    expect(layer("trail-obstacles-hit")?.props.afterId).toBe("trail-route-line");
  });

  it("opens the tapped obstacle's card in place of the map controls", async () => {
    await renderWithProviders(<RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles("o1", "o2")} />);
    expect(screen.getByLabelText("Visa satellitkarta")).toBeTruthy();

    await tapObstacles("o2");

    expect(screen.getByTestId("obstacle-card-o2")).toHaveTextContent("trail-1:o2", { exact: false });
    expect(screen.queryByTestId("obstacle-card-o1")).toBeNull();
    expect(screen.queryByLabelText("Visa satellitkarta")).toBeNull();
    expect(enlargedPin()).toBe("o2");
  });

  it("opens stacked pins as one carousel, in the trail's own order", async () => {
    await renderWithProviders(<RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles("o1", "o2", "o3")} />);

    await tapObstacles("o3", "o1");

    const shown = screen.getAllByTestId(/^obstacle-card-/).map((card) => card.props.testID);
    expect(shown).toEqual(["obstacle-card-o1", "obstacle-card-o3"]);
    expect(screen.getAllByTestId("obstacle-carousel-dot")).toHaveLength(2);
    expect(enlargedPin()).toBe("o1");
  });

  it("enlarges the pin of the card the carousel settles on", async () => {
    await renderWithProviders(<RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles("o1", "o2")} />);
    await tapObstacles("o1", "o2");

    await swipeToCard(1);

    expect(enlargedPin()).toBe("o2");
  });

  // keep-comment: a vote refetches the list with new objects, which must not throw the reader back to the first card
  it("keeps the card that is showing when a vote refetches the list", async () => {
    const { rerender } = await renderWithProviders(
      <RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles("o1", "o2")} />,
    );
    await tapObstacles("o1", "o2");
    await swipeToCard(1);

    await rerender(<RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles("o1", "o2")} />);

    expect(enlargedPin()).toBe("o2");
  });

  it("starts at the first card again when the pins are tapped anew", async () => {
    await renderWithProviders(<RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles("o1", "o2")} />);
    await tapObstacles("o1", "o2");
    await swipeToCard(1);

    await tapObstacles("o1", "o2");

    expect(enlargedPin()).toBe("o1");
    expect(screen.getAllByTestId("obstacle-carousel-dot")[0]).toHaveStyle({ width: 18 });
  });

  it("closes the carousel from its handle", async () => {
    await renderWithProviders(<RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles("o1")} />);
    await tapObstacles("o1");

    await fireEvent.press(screen.getByLabelText("Stäng"));

    expect(screen.queryByTestId("obstacle-carousel")).toBeNull();
    expect(screen.getByLabelText("Visa satellitkarta")).toBeTruthy();
  });

  it("closes the carousel on a tap elsewhere on the map", async () => {
    await renderWithProviders(<RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles("o1")} />);
    await tapObstacles("o1");

    await act(async () => screen.getByTestId("maplibre-Map").props.onPress());

    expect(screen.queryByTestId("obstacle-carousel")).toBeNull();
  });

  // keep-comment: three solved votes hide an obstacle on the server, so the refetch drops it from the list
  it("drops a card whose obstacle is gone from the list, and closes when none is left", async () => {
    const { rerender } = await renderWithProviders(
      <RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles("o1", "o2", "o3")} />,
    );
    await tapObstacles("o1", "o2");

    await rerender(<RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles("o2", "o3")} />);
    expect(screen.queryByTestId("obstacle-card-o1")).toBeNull();
    expect(enlargedPin()).toBe("o2");

    await rerender(<RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles("o3")} />);
    expect(screen.queryByTestId("obstacle-carousel")).toBeNull();
  });

  // keep-comment: a withdrawn vote brings the obstacle back in the next refetch, which must not reopen its card
  it("keeps the carousel closed when its obstacle comes back in a later refetch", async () => {
    const { rerender } = await renderWithProviders(
      <RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles("o1")} />,
    );
    await tapObstacles("o1");
    await rerender(<RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles()} />);

    await rerender(<RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles("o1")} />);

    expect(screen.queryByTestId("obstacle-carousel")).toBeNull();
  });

  // keep-comment: the data licence and MapTiler's Free plan require both on screen at all times (map.tsx)
  it("lifts the attribution and logo above the open carousel, and lowers them again when it closes", async () => {
    await renderWithProviders(<RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles("o1")} />);
    const resting = attribution();

    await tapObstacles("o1");
    expect(attribution()).toEqual(resting);
    await measureCarousel(170);
    expect(attribution().bottom).toBe(170 + SCREEN_PADDING);

    await fireEvent.press(screen.getByLabelText("Stäng"));
    expect(attribution()).toEqual(resting);
  });

  // keep-comment: the carousel is not remounted by another tap, so it may never measure again
  it("keeps the attribution above the carousel when pins are tapped while it is open", async () => {
    await renderWithProviders(<RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles("o1", "o2")} />);
    await tapObstacles("o1");
    await measureCarousel(170);

    await tapObstacles("o2");

    expect(attribution().bottom).toBe(170 + SCREEN_PADDING);
  });

  it("does not reuse a closed carousel's height for the next one", async () => {
    await renderWithProviders(<RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles("o1")} />);
    const resting = attribution();
    await tapObstacles("o1");
    await measureCarousel(170);
    await fireEvent.press(screen.getByLabelText("Stäng"));

    await tapObstacles("o1");

    expect(attribution()).toEqual(resting);
  });

  // keep-comment: a reused card would carry the last obstacle's edit form into this one, and save its text here
  it("gives each obstacle a card of its own when another pin is tapped", async () => {
    await renderWithProviders(<RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles("o1", "o2")} />);
    await tapObstacles("o1");

    await tapObstacles("o2");

    expect(screen.getByTestId("obstacle-card-o2")).toHaveTextContent("mounted for o2", { exact: false });
  });

  it("keeps the carousel open when the start marker is tapped for directions", async () => {
    await renderWithProviders(<RouteFollowView idPrefix="trail" path={PATH} obstacles={obstacles("o1")} />);
    await tapObstacles("o1");
    const start = screen.queryAllByTestId("maplibre-GeoJSONSource").find((n) => n.props.id === "trail-start");
    if (!start) throw new Error("expected the start marker");
    const stopPropagation = jest.fn();

    await fireEvent(start, "press", { nativeEvent: { features: [] }, stopPropagation });

    expect(stopPropagation).toHaveBeenCalled();
    expect(screen.getByTestId("obstacle-carousel")).toBeTruthy();
  });
});
