// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import TrailDetailsScreen from "@/components/trail/trail-details-screen";
import { Trail } from "@/data/types";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const mockGetTrail = jest.fn();
const mockGetObstacles = jest.fn();
const mockGetCoordinates = jest.fn();
const mockNavigate = jest.fn();

jest.mock("@/api/trails", () => ({
  getTrailByIdentifier: (...args: unknown[]) => mockGetTrail(...args),
  getCoordinatesByTrailIdentifier: (...args: unknown[]) => mockGetCoordinates(...args),
}));

jest.mock("@/api/trail-obstacles", () => ({
  getTrailObstaclesByTrailIdentifier: (...args: unknown[]) => mockGetObstacles(...args),
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ identifier: "trail-1" }),
  useRouter: () => ({ navigate: (...args: unknown[]) => mockNavigate(...args), back: jest.fn() }),
  router: { back: jest.fn() },
}));

// The screen composes parts that each have their own suite or queries, so they are stood in for here.
jest.mock("@/components/trail/image-gallery", () => "ImageGallery");
jest.mock("@/components/trail/trail-info", () => "TrailInfo");
jest.mock("@/components/trail/trail-description", () => "TrailDescription");
jest.mock("@/components/trail/trail-misc-section/trail-misc-accordion", () => "TrailMiscInfo");
jest.mock("@/components/trail/user-action-bar/user-bar", () => "UserBar");

jest.mock("@/components/trail/trail-map", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  return {
    __esModule: true,
    default: ({ onPress }: { onPress: () => void }) =>
      ReactActual.createElement(Pressable, { onPress }, ReactActual.createElement(Text, null, "trail-map")),
  };
});

jest.mock("@/components/review/trail-reviews-container", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  return {
    __esModule: true,
    default: ({ onReviewsLoaded }: { onReviewsLoaded: (reviews: unknown[], total: number) => void }) =>
      ReactActual.createElement(
        Pressable,
        { onPress: () => onReviewsLoaded([{ identifier: "r1", rating: 4 }], 3) },
        ReactActual.createElement(Text, null, "reviews-loaded"),
      ),
  };
});

function trail(overrides: Partial<Trail> = {}): Trail {
  return {
    identifier: "trail-1",
    name: "Kvarnstigen",
    trailLength: 4.2,
    city: "Borås",
    classification: 2,
    description: "En stig längs ån.",
    trailImagesResponse: [],
    ...overrides,
  } as Trail;
}

const COORDINATES = JSON.stringify([
  { latitude: 57.72, longitude: 12.94 },
  { latitude: 57.73, longitude: 12.95 },
]);

async function show() {
  const rendered = renderWithProviders(<TrailDetailsScreen followRoute="/(tabs)/(map)/follow/[identifier]" />);
  await flushUntil(() => screen.queryByText("Kvarnstigen"));
  return rendered;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetTrail.mockResolvedValue(trail());
  mockGetObstacles.mockResolvedValue([]);
  mockGetCoordinates.mockResolvedValue({ coordinates: COORDINATES });
  // guardedNavigate debounces on module state for 500 ms.
  let clock = 6_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("waits for the trail before drawing anything else", () => {
  mockGetTrail.mockReturnValue(new Promise(() => {}));
  renderWithProviders(<TrailDetailsScreen followRoute="/(tabs)/(map)/follow/[identifier]" />);

  expect(screen.queryByText("Kvarnstigen")).toBeNull();
  expect(screen.queryByText("Tillbaka till toppen")).toBeNull();
});

it("offers a retry instead of a half-empty page when the trail cannot be fetched", async () => {
  mockGetTrail.mockRejectedValue(new Error("500"));
  renderWithProviders(<TrailDetailsScreen followRoute="/(tabs)/(map)/follow/[identifier]" />);
  await flushUntil(() => screen.queryByText("Försök igen"));

  expect(screen.queryByText("Kvarnstigen")).toBeNull();
  const retry = screen.getByText("Försök igen");
  expect(retry).toBeTruthy();

  mockGetTrail.mockResolvedValue(trail());
  fireEvent.press(retry);
  await flushUntil(() => screen.queryByText("Kvarnstigen"));
  expect(screen.getByText("Kvarnstigen")).toBeTruthy();
});

it("shows the trail once it arrives", async () => {
  await show();

  expect(screen.getByText("Kvarnstigen")).toBeTruthy();
  expect(screen.getByText("Tillbaka till toppen")).toBeTruthy();
});

// The map waits for the geometry and the end of the screen transition; a MapView built during
// the push animation stutters it.
it("holds a skeleton where the map goes until the route is in", async () => {
  mockGetCoordinates.mockResolvedValue({ coordinates: "[]" });
  await show();
  await settle();

  expect(screen.getByText("Laddar karta...")).toBeTruthy();
  expect(screen.queryByText("trail-map")).toBeNull();
});

it("draws the map once the route is in, and opens the follow view in this stack", async () => {
  await show();
  await flushUntil(() => screen.queryByText("trail-map"));

  fireEvent.press(screen.getByText("trail-map"));

  expect(mockNavigate).toHaveBeenCalledWith({
    pathname: "/(tabs)/(map)/follow/[identifier]",
    params: { identifier: "trail-1" },
  });
});

// The warning is the only sign a trail is blocked, and it stays away when nothing is reported.
it("warns about obstacles only when there are some, and opens them", async () => {
  const { unmount } = await show();
  expect(screen.queryByText(/hinder/i)).toBeNull();
  unmount();

  mockGetObstacles.mockResolvedValue([{ identifier: "o1", issueType: "FallenTree", description: "Träd över stigen" }]);
  await show();
  await flushUntil(() => screen.queryByText(/hinder/i));

  expect(screen.getByText(/hinder/i)).toBeTruthy();
});

// The rating row follows what the reviews container reports, so it waits for something to count.
it("shows the rating row only once reviews have been counted", async () => {
  await show();
  expect(screen.queryByText("Läs recensioner")).toBeNull();

  fireEvent.press(screen.getByText("reviews-loaded"));

  expect(screen.getByText("Läs recensioner")).toBeTruthy();
  // The count is a sibling string inside the same Text as the label.
  expect(screen.getByText(/(3)/)).toBeTruthy();
});
