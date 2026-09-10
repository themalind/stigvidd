// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import MapScreen from "@/app/(tabs)/(map)/index";
import { SCREEN_PADDING } from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { MapMarkerFilter } from "@/data/types";
import { UserLocation } from "@/hooks/useUserLocation";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen } from "@testing-library/react-native";

const mockNavigate = jest.fn();
const mockFlyTo = jest.fn();

let mockLocation: UserLocation | null = null;

// guardedNavigate debounces on Date.now() in module state, so the tests drive a fake clock.
let mockNow = 1_700_000_000_000;

// useFocusEffect tells the screen the tab was left: the map unmounts on blur, the screen does not.
const mockFocus: { run: (() => void | (() => void)) | null; cleanup: void | (() => void) } = {
  run: null,
  cleanup: undefined,
};

jest.mock("expo-router", () => {
  const ReactActual = jest.requireActual("react");
  return {
    useRouter: () => ({ navigate: (...args: unknown[]) => mockNavigate(...args) }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      mockFocus.run = callback;
      ReactActual.useEffect(() => {
        mockFocus.cleanup = callback();
        return () => {
          if (typeof mockFocus.cleanup === "function") mockFocus.cleanup();
        };
      }, [callback]);
    },
  };
});

jest.mock("@/hooks/useUserLocation", () => ({
  useUserLocation: () => ({ data: mockLocation }),
}));

interface MarkersMapProps {
  filter: MapMarkerFilter;
  cameraRef: { current: unknown };
  highlight: { coordinate: [number, number]; radius: number } | null;
  initialViewState?: { center: [number, number]; zoom: number; bearing?: number; pitch?: number };
  attributionPosition?: { bottom: number; left: number };
  onRegionDidChange: (event: unknown) => void;
  onClusterOpen: (
    identifiers: string[],
    highlight: { coordinate: [number, number]; radius: number },
    expansionZoom?: number,
  ) => void;
  onMapPress: () => void;
  onMapReady: () => void;
}

// The map has its own suite; this stub covers the wiring — what the screen hands it, and what comes back.
const mockMap: { props: MarkersMapProps | null } = { props: null };

jest.mock("@/components/map/trail-markers-map", () => {
  const ReactActual = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: (props: MarkersMapProps) => {
      mockMap.props = props;
      // The screen only ever calls flyTo on the camera handle.
      props.cameraRef.current = { flyTo: (...args: unknown[]) => mockFlyTo(...args) };
      return ReactActual.createElement(View, { testID: "trail-markers-map" });
    },
  };
});

interface CarouselProps {
  identifiers: string[];
  onMeasure: (height: number) => void;
  onClose: () => void;
  onReadMore: (identifier: string) => void;
  onShowOnMap: (identifier: string) => void;
}

const mockCarousel: { props: CarouselProps | null } = { props: null };

jest.mock("@/components/map/trail-card-carousel", () => {
  const ReactActual = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: (props: CarouselProps) => {
      mockCarousel.props = props;
      return ReactActual.createElement(View, { testID: "trail-card-carousel" });
    },
  };
});

const HERE: UserLocation = { latitude: 57.5, longitude: 12.5, isFallback: false };
const BORAS_FALLBACK: UserLocation = { latitude: 57.721, longitude: 12.94, isFallback: true };
const TAP = { coordinate: [12.5, 57.5] as [number, number], radius: 26 };

type AppTheme = typeof AppDefaultTheme | typeof AppDarkTheme;

beforeEach(() => {
  jest.clearAllMocks();
  mockMap.props = null;
  mockCarousel.props = null;
  mockFocus.run = null;
  mockFocus.cleanup = undefined;
  mockLocation = HERE;
  // Past every debounce window the previous test may have opened.
  mockNow += 10_000;
  jest.spyOn(Date, "now").mockImplementation(() => mockNow);
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function show(theme: AppTheme = AppDefaultTheme) {
  const rendered = renderWithProviders(<MapScreen />, { theme });
  await settle();
  return rendered;
}

function map() {
  if (!mockMap.props) throw new Error("The map is not mounted");
  return mockMap.props;
}

// The map renders only once it reports ready, so every test past the cover says so first.
async function mapReady() {
  await act(async () => {
    map().onMapReady();
  });
}

async function blur() {
  await act(async () => {
    if (typeof mockFocus.cleanup === "function") mockFocus.cleanup();
  });
}

async function refocus() {
  await act(async () => {
    mockFocus.cleanup = mockFocus.run?.();
  });
}

async function pan(zoom: number, { userInteraction = true, center = [12.5, 57.5], bearing = 0, pitch = 0 } = {}) {
  await act(async () => {
    map().onRegionDidChange({ nativeEvent: { center, zoom, bearing, pitch, userInteraction } });
  });
}

async function openCluster(identifiers: string[], expansionZoom?: number) {
  await act(async () => {
    map().onClusterOpen(identifiers, TAP, expansionZoom);
  });
}

async function toggleFilter(key: keyof MapMarkerFilter) {
  fireEvent.press(screen.getByTestId("map-filter-trigger"));
  await settle();
  fireEvent.press(screen.getByTestId(`map-filter-row-${key}`));
  await settle();
}

describe("MapScreen — the map and its cover", () => {
  it("mounts the map on the focused tab", async () => {
    await show();

    expect(screen.getByTestId("trail-markers-map")).toBeOnTheScreen();
  });

  it("fills the screen", async () => {
    await show();

    expect(screen.getByTestId("map-screen")).toHaveStyle({ flex: 1 });
  });

  it("floats the filter menu in the top-right corner", async () => {
    await show();

    expect(screen.getByTestId("map-top-bar")).toHaveStyle({
      position: "absolute",
      top: SCREEN_PADDING,
      right: SCREEN_PADDING,
    });
    expect(screen.getByTestId("map-filter-trigger")).toBeOnTheScreen();
  });

  // The cover hides the map's first blank frames.
  it("covers the map until it reports itself ready", async () => {
    await show();

    expect(screen.getByTestId("map-cover")).toBeOnTheScreen();

    await mapReady();

    expect(screen.queryByTestId("map-cover")).toBeNull();
  });

  it("paints the cover in the theme background", async () => {
    await show();

    expect(screen.getByTestId("map-cover")).toHaveStyle({
      position: "absolute",
      backgroundColor: AppDefaultTheme.colors.background,
    });
  });

  it("paints the cover dark in dark mode", async () => {
    await show(AppDarkTheme);

    expect(screen.getByTestId("map-cover")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.background });
  });
});

describe("MapScreen — leaving and returning to the tab", () => {
  it("unmounts the map on blur", async () => {
    await show();
    await mapReady();

    await blur();

    expect(screen.queryByTestId("trail-markers-map")).toBeNull();
  });

  it("covers the empty space left behind", async () => {
    await show();
    await mapReady();

    await blur();

    expect(screen.getByTestId("map-cover")).toBeOnTheScreen();
  });

  // The screen stays mounted across the map's blur, which is how it remembers the camera.
  it("keeps the screen's own chrome up while the map is away", async () => {
    await show();
    await blur();

    expect(screen.getByTestId("map-top-bar")).toBeOnTheScreen();
    expect(screen.getByTestId("map-screen")).toBeOnTheScreen();
  });

  it("mounts the map again on return", async () => {
    await show();
    await mapReady();
    await blur();

    await refocus();

    expect(screen.getByTestId("trail-markers-map")).toBeOnTheScreen();
  });
});

describe("MapScreen — opening on the user", () => {
  it("waits for the map before moving the camera", async () => {
    await show();

    expect(mockFlyTo).not.toHaveBeenCalled();
  });

  it("glides to the user once the map is ready", async () => {
    await show();

    await mapReady();

    expect(mockFlyTo).toHaveBeenCalledWith({ center: [HERE.longitude, HERE.latitude], zoom: 12, duration: 1000 });
  });

  // The fallback is Borås, not the user — gliding to it would present a guess as a fix.
  it("does not glide when there is no real fix", async () => {
    mockLocation = BORAS_FALLBACK;
    await show();

    await mapReady();

    expect(mockFlyTo).not.toHaveBeenCalled();
  });

  it("does not glide before the location arrives", async () => {
    mockLocation = null;
    await show();

    await mapReady();

    expect(mockFlyTo).not.toHaveBeenCalled();
  });

  it("glides once the location turns up late", async () => {
    mockLocation = null;
    await show();
    await mapReady();

    mockLocation = HERE;
    await toggleFilter("shelters");

    expect(mockFlyTo).toHaveBeenCalledWith({ center: [HERE.longitude, HERE.latitude], zoom: 12, duration: 1000 });
  });

  // Centres on the first fix only; a later fix must not move a camera the user has panned.
  it("glides only once, however the location is refreshed", async () => {
    await show();
    await mapReady();

    mockLocation = { latitude: 58.9, longitude: 11.1, isFallback: false };
    await toggleFilter("shelters");

    expect(mockFlyTo).toHaveBeenCalledTimes(1);
  });

  it("does not glide again on a return visit", async () => {
    await show();
    await mapReady();
    await blur();
    await refocus();
    await mapReady();

    mockLocation = { latitude: 58.9, longitude: 11.1, isFallback: false };
    await toggleFilter("shelters");

    expect(mockFlyTo).toHaveBeenCalledTimes(1);
  });
});

describe("MapScreen — the remembered view", () => {
  it("seeds the camera from a cached fix, so a warm return skips the Borås flash", async () => {
    await show();

    expect(map().initialViewState).toEqual({ center: [HERE.longitude, HERE.latitude], zoom: 12 });
  });

  it("leaves the camera to the map's own default when there is no real fix", async () => {
    mockLocation = BORAS_FALLBACK;
    await show();

    expect(map().initialViewState).toBeUndefined();
  });

  it("reopens where the user left off", async () => {
    await show();
    await mapReady();
    await pan(13.5, { center: [11.9, 58.1], bearing: 30, pitch: 15 });

    await blur();
    await refocus();

    expect(map().initialViewState).toEqual({ center: [11.9, 58.1], zoom: 13.5, bearing: 30, pitch: 15 });
  });

  // The remembered view outranks the location fix on return to the tab.
  it("prefers the remembered view over the user's position", async () => {
    await show();
    await mapReady();
    await pan(9, { center: [11.9, 58.1] });

    await blur();
    await refocus();

    expect(map().initialViewState?.center).toEqual([11.9, 58.1]);
  });
});

describe("MapScreen — the carousel", () => {
  it("shows nothing until a cluster is tapped", async () => {
    await show();
    await mapReady();

    expect(screen.queryByTestId("trail-card-carousel")).toBeNull();
  });

  it("opens on the tapped cluster's trails", async () => {
    await show();
    await mapReady();

    await openCluster(["t-1", "t-2", "t-3"]);

    expect(screen.getByTestId("trail-card-carousel")).toBeOnTheScreen();
    expect(mockCarousel.props?.identifiers).toEqual(["t-1", "t-2", "t-3"]);
  });

  // The ring marks which marker the open cards belong to.
  it("rings the tapped marker while the cards are open", async () => {
    await show();
    await mapReady();

    await openCluster(["t-1"]);

    expect(map().highlight).toEqual(TAP);
  });

  it("replaces the cards when another cluster is tapped", async () => {
    await show();
    await mapReady();
    await openCluster(["t-1"]);

    await openCluster(["t-7", "t-8"]);

    expect(mockCarousel.props?.identifiers).toEqual(["t-7", "t-8"]);
  });

  it("closes on the carousel's own close button", async () => {
    await show();
    await mapReady();
    await openCluster(["t-1"]);

    await act(async () => mockCarousel.props?.onClose());

    expect(screen.queryByTestId("trail-card-carousel")).toBeNull();
  });

  it("drops the ring when the cards close", async () => {
    await show();
    await mapReady();
    await openCluster(["t-1"]);

    await act(async () => mockCarousel.props?.onClose());

    expect(map().highlight).toBeNull();
  });

  it("closes on a tap anywhere else on the map", async () => {
    await show();
    await mapReady();
    await openCluster(["t-1"]);

    await act(async () => map().onMapPress());

    expect(screen.queryByTestId("trail-card-carousel")).toBeNull();
  });

  // Two controls in the same corner: the locate button steps aside for the cards.
  it("hides the locate button behind the open cards", async () => {
    await show();
    await mapReady();

    await openCluster(["t-1"]);

    expect(screen.queryByTestId("center-on-user")).toBeNull();
  });

  it("brings the locate button back once they close", async () => {
    await show();
    await mapReady();
    await openCluster(["t-1"]);

    await act(async () => mockCarousel.props?.onClose());

    expect(screen.getByTestId("center-on-user")).toBeOnTheScreen();
  });
});

describe("MapScreen — the attribution button clears the cards", () => {
  it("sits in the corner while nothing covers it", async () => {
    await show();

    expect(map().attributionPosition).toEqual({ bottom: SCREEN_PADDING, left: SCREEN_PADDING });
  });

  // Card height varies with content, so the lift is measured rather than assumed.
  it("lifts above the measured card height", async () => {
    await show();
    await mapReady();
    await openCluster(["t-1"]);

    await act(async () => mockCarousel.props?.onMeasure(180));

    expect(map().attributionPosition?.bottom).toBe(180 + SCREEN_PADDING);
  });

  it("drops back down when the cards close", async () => {
    await show();
    await mapReady();
    await openCluster(["t-1"]);
    await act(async () => mockCarousel.props?.onMeasure(180));

    await act(async () => mockCarousel.props?.onClose());

    expect(map().attributionPosition?.bottom).toBe(SCREEN_PADDING);
  });
});

describe("MapScreen — the zoom band that dismisses the cards", () => {
  it("keeps the cards while the cluster still holds together", async () => {
    await show();
    await mapReady();
    await pan(10);
    await openCluster(["t-1", "t-2"], 13);

    await pan(12);

    expect(screen.getByTestId("trail-card-carousel")).toBeOnTheScreen();
  });

  it("dismisses them once the cluster splits", async () => {
    await show();
    await mapReady();
    await pan(10);
    await openCluster(["t-1", "t-2"], 13);

    await pan(13);

    expect(screen.queryByTestId("trail-card-carousel")).toBeNull();
  });

  it("dismisses them once it merges into a bigger cluster", async () => {
    await show();
    await mapReady();
    await pan(10);
    await openCluster(["t-1", "t-2"], 13);

    await pan(9.5);

    expect(screen.queryByTestId("trail-card-carousel")).toBeNull();
  });

  // A lone trail never splits, so zooming in on it is not a reason to dismiss it.
  it("lets a single trail's card survive any zoom-in", async () => {
    await show();
    await mapReady();
    await pan(10);
    await openCluster(["t-1"]);

    await pan(16);

    expect(screen.getByTestId("trail-card-carousel")).toBeOnTheScreen();
  });

  it("still dismisses a single trail's card on zoom-out", async () => {
    await show();
    await mapReady();
    await pan(10);
    await openCluster(["t-1"]);

    await pan(9.5);

    expect(screen.queryByTestId("trail-card-carousel")).toBeNull();
  });

  // The restore on return is a programmatic move, so it does not dismiss the cards.
  it("ignores a camera move the user did not make", async () => {
    await show();
    await mapReady();
    await pan(10);
    await openCluster(["t-1", "t-2"], 13);

    await pan(18, { userInteraction: false });

    expect(screen.getByTestId("trail-card-carousel")).toBeOnTheScreen();
  });

  it("keeps the cards through a pan at an unchanged zoom", async () => {
    await show();
    await mapReady();
    await pan(10);
    await openCluster(["t-1", "t-2"], 13);

    await pan(10, { center: [11.1, 59.2] });

    expect(screen.getByTestId("trail-card-carousel")).toBeOnTheScreen();
  });

  // Nothing has reported a zoom yet, so there is no band to leave.
  it("never dismisses cards opened before any zoom was known", async () => {
    await show();
    await mapReady();
    await openCluster(["t-1", "t-2"], 13);

    await pan(18);

    expect(screen.getByTestId("trail-card-carousel")).toBeOnTheScreen();
  });
});

describe("MapScreen — leaving for a trail", () => {
  it("opens the trail page from a card", async () => {
    await show();
    await mapReady();
    await openCluster(["t-1"]);

    await act(async () => mockCarousel.props?.onReadMore("t-1"));

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: "/(tabs)/(map)/trail/[identifier]",
      params: { identifier: "t-1" },
    });
  });

  it("opens the follow view from a card", async () => {
    await show();
    await mapReady();
    await openCluster(["t-1"]);

    await act(async () => mockCarousel.props?.onShowOnMap("t-1"));

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: "/(tabs)/(map)/follow/[identifier]",
      params: { identifier: "t-1" },
    });
  });

  // A double tap on a card would otherwise push the same screen twice.
  it("swallows a second tap inside the debounce window", async () => {
    await show();
    await mapReady();
    await openCluster(["t-1"]);

    await act(async () => mockCarousel.props?.onReadMore("t-1"));
    mockNow += 200;
    await act(async () => mockCarousel.props?.onReadMore("t-1"));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("lets a deliberate second tap through", async () => {
    await show();
    await mapReady();
    await openCluster(["t-1"]);

    await act(async () => mockCarousel.props?.onReadMore("t-1"));
    mockNow += 600;
    await act(async () => mockCarousel.props?.onReadMore("t-1"));

    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  it("guards the follow view against the read-more tap that preceded it", async () => {
    await show();
    await mapReady();
    await openCluster(["t-1"]);

    await act(async () => mockCarousel.props?.onReadMore("t-1"));
    mockNow += 100;
    await act(async () => mockCarousel.props?.onShowOnMap("t-1"));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});

describe("MapScreen — the marker filter", () => {
  it("starts with trails alone", async () => {
    await show();

    expect(map().filter).toEqual({ trails: true, shelters: false, firePits: false, accessibility: false });
  });

  it("hands the map the category the user switched on", async () => {
    await show();
    await mapReady();

    await toggleFilter("shelters");

    expect(map().filter).toEqual({ trails: true, shelters: true, firePits: false, accessibility: false });
  });

  it("hands the map the category the user switched off", async () => {
    await show();
    await mapReady();

    await toggleFilter("trails");

    expect(map().filter.trails).toBe(false);
  });
});

describe("MapScreen — the locate button", () => {
  it("is there once there is somewhere to fly to", async () => {
    await show();

    expect(screen.getByTestId("center-on-user")).toBeOnTheScreen();
  });

  // Borås is the fallback, not the user, so no centre-on-me button is offered for it.
  it("stays away while the position is only the fallback", async () => {
    mockLocation = BORAS_FALLBACK;
    await show();

    expect(screen.queryByTestId("center-on-user")).toBeNull();
  });

  it("flies to the user, closer in than the opening glide", async () => {
    await show();
    await mapReady();
    mockFlyTo.mockClear();

    fireEvent.press(screen.getByTestId("center-on-user"));

    expect(mockFlyTo).toHaveBeenCalledWith({ center: [HERE.longitude, HERE.latitude], zoom: 14, duration: 800 });
  });

  it("sits clear of the tab bar in the bottom-right corner", async () => {
    await show();

    expect(screen.getByTestId("center-on-user")).toHaveStyle({
      position: "absolute",
      bottom: 18,
      right: 15,
      borderRadius: 999,
      borderWidth: 2,
    });
  });

  // The basemap is always light, so the control keeps the light palette in dark mode.
  it("keeps the light control palette in dark mode", async () => {
    await show(AppDarkTheme);

    expect(screen.getByTestId("center-on-user")).toHaveStyle({
      backgroundColor: AppDefaultTheme.colors.primary,
      borderColor: AppDefaultTheme.colors.onPrimary,
    });
    expect(AppDarkTheme.colors.primary).not.toBe(AppDefaultTheme.colors.primary);
  });
});
