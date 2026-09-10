// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Hike } from "@/data/types";
import { flushUntil, settle } from "@/test/flush";
import { stubMeasureInWindow } from "@/test/measure";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import MyHikesScreen from "../my-hikes";

const mockGetHikes = jest.fn();

jest.mock("@/api/hikes", () => ({
  getAllHikesByUserId: (...args: unknown[]) => mockGetHikes(...args),
  deleteHike: jest.fn(),
  shareHike: jest.fn(),
  updateHike: jest.fn(),
  hikeRouteQueryKey: (id: string) => ["hike-route", id],
}));

jest.mock("@/api/friends", () => ({ getFriends: jest.fn().mockResolvedValue([]) }));

jest.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ isAuthenticated: true }) }));

jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom({ data: { identifier: "me" } }) };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: jest.fn(), back: jest.fn() }),
  router: { navigate: jest.fn(), back: jest.fn() },
}));

let measured: ReturnType<typeof stubMeasureInWindow>;

beforeAll(() => {
  measured = stubMeasureInWindow();
  Platform.OS = "android";
});

afterAll(() => {
  measured.restore();
  Platform.OS = "ios";
});

function hike(overrides: Partial<Hike> = {}): Hike {
  return {
    identifier: "hike-1",
    name: "Kvällspromenad",
    hikeLength: 4.2,
    duration: 5_400_000,
    createdBy: "me",
    createdAt: "2026-05-04T18:00:00Z",
    coordinates: JSON.stringify([
      { latitude: 57.72, longitude: 12.94 },
      { latitude: 57.73, longitude: 12.95 },
    ]),
    ...overrides,
  };
}

const HIKES = [
  hike(),
  hike({
    identifier: "hike-2",
    name: "Morgonrunda",
    hikeLength: 9.5,
    duration: 3_600_000,
    createdAt: "2026-04-01T07:00:00Z",
  }),
];

async function show() {
  const rendered = renderWithProviders(<MyHikesScreen />);
  await flushUntil(() => screen.queryByText("Kvällspromenad") ?? screen.queryByText("Inga sparade promenader"));
  return rendered;
}

function search(query: string) {
  fireEvent.press(screen.getByTestId("icon-search"));
  fireEvent.changeText(screen.getByPlaceholderText("Sök bland promenader..."), query);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetHikes.mockResolvedValue(HIKES);
});

it("lists the walks with their length, time and date", async () => {
  await show();

  expect(screen.getByText("Kvällspromenad")).toBeTruthy();
  expect(screen.getByText("4.2 km")).toBeTruthy();
  expect(screen.getByText("01:30:00")).toBeTruthy();
  expect(screen.getByText("2026-05-04")).toBeTruthy();
});

it("fetches only the signed-in user's own walks", async () => {
  await show();

  expect(mockGetHikes).toHaveBeenCalledWith("me");
});

// Two empty states again: no walks recorded, and a search that hid them.
it("tells an empty list apart from a search that matched nothing", async () => {
  mockGetHikes.mockResolvedValue([]);
  const { unmount } = await show();
  expect(screen.getByText("Inga sparade promenader")).toBeTruthy();
  unmount();

  mockGetHikes.mockResolvedValue(HIKES);
  await show();
  search("finns inte");

  expect(screen.getByText("Inga promenader hittades")).toBeTruthy();
  expect(screen.getByText("Prova att ändra dina filter")).toBeTruthy();
});

it("searches the walks by name", async () => {
  await show();

  search("morgon");

  expect(screen.getByText("Morgonrunda")).toBeTruthy();
  expect(screen.queryByText("Kvällspromenad")).toBeNull();
  expect(screen.getByText("Visar 1 av 2 promenader")).toBeTruthy();
});

// The banner sums the whole collection, and there is nothing to sum when it is empty.
it("keeps the summary banner off an empty list", async () => {
  const { unmount } = await show();
  expect(screen.getByText("Vandrat totalt")).toBeTruthy();
  unmount();

  mockGetHikes.mockResolvedValue([]);
  await show();
  expect(screen.queryByText("Vandrat totalt")).toBeNull();
});

it("opens the walk that was tapped", async () => {
  await show();

  fireEvent.press(screen.getByText("Morgonrunda"));
  await settle();

  // The detail modal repeats the name and adds what only it shows.
  expect(screen.getAllByText("Morgonrunda").length).toBeGreaterThan(1);
  expect(screen.getByText("Dela")).toBeTruthy();
});
