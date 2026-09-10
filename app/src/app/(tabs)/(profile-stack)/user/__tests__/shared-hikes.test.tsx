// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SharedHike } from "@/data/types";
import { flushUntil, settle } from "@/test/flush";
import { stubMeasureInWindow } from "@/test/measure";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import SharedHikesScreen from "../shared-hikes";

const mockGetSharedHikes = jest.fn();
const mockGetIncoming = jest.fn();
const mockAccept = jest.fn();
const mockReject = jest.fn();
const mockRefetchIncoming = jest.fn();
let mockIncoming: { data?: unknown[]; isPending: boolean; isError: boolean };
let mockMutationsPending = false;

jest.mock("@/api/shared-hikes", () => ({
  getSharedHikes: () => mockGetSharedHikes(),
  getIncomingSharedHike: (...args: unknown[]) => mockGetIncoming(...args),
  removeSharedHike: jest.fn(),
  reshareHike: jest.fn(),
}));

jest.mock("@/api/hikes", () => ({ hikeRouteQueryKey: (id: string) => ["hike-route", id] }));
jest.mock("@/api/friends", () => ({ getFriends: jest.fn().mockResolvedValue([]) }));

jest.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ isAuthenticated: true }) }));

jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom({ data: { identifier: "me", nickName: "jag" } }) };
});

// The real atom is a query atom that would fetch; the screen only reads its result shape.
jest.mock("@/atoms/friends-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return {
    incomingSharedHikesAtom: atom(() => ({
      ...mockIncoming,
      refetch: mockRefetchIncoming,
    })),
  };
});

jest.mock("@/hooks/shared-hikes/useSharedHikeMutations", () => ({
  useSharedHikeMutations: () => ({
    acceptMutation: { mutate: mockAccept, isPending: mockMutationsPending },
    rejectMutation: { mutate: mockReject, isPending: mockMutationsPending },
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: jest.fn(), back: jest.fn() }),
  router: { navigate: jest.fn(), back: jest.fn() },
}));

let measured: ReturnType<typeof stubMeasureInWindow>;

// The header's sort menu and its selects have their own suites.
beforeAll(() => {
  measured = stubMeasureInWindow();
  Platform.OS = "android";
});

afterAll(() => {
  measured.restore();
  Platform.OS = "ios";
});

function sharedHike(overrides: Partial<SharedHike> = {}): SharedHike {
  return {
    hikeIdentifier: "hike-1",
    hikeName: "Kvällspromenad",
    hikeLength: 4.2,
    duration: 5_400_000,
    coordinates: JSON.stringify([
      { latitude: 57.72, longitude: 12.94 },
      { latitude: 57.73, longitude: 12.95 },
    ]),
    createdByName: "bertil",
    sharedByName: "bertil",
    sharedByIdentifier: "friend-1",
    sharedAt: "2026-05-04T18:00:00Z",
    allowResharing: true,
    ...overrides,
  };
}

function incoming(count: number) {
  return Array.from({ length: count }, (_, i) =>
    sharedHike({ hikeIdentifier: `in-${i}`, hikeName: `Förfrågan ${i}`, sharedByName: `vän-${i}` }),
  );
}

async function show() {
  const rendered = renderWithProviders(<SharedHikesScreen />);
  await flushUntil(() => screen.queryByText("Delade promenader"));
  return rendered;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMutationsPending = false;
  mockIncoming = { data: [], isPending: false, isError: false };
  mockGetSharedHikes.mockResolvedValue([sharedHike()]);
  mockGetIncoming.mockResolvedValue(sharedHike({ hikeIdentifier: "in-0", hikeName: "Förfrågan 0" }));
});

it("waits for both lists before drawing the page", () => {
  mockIncoming = { data: undefined, isPending: true, isError: false };
  renderWithProviders(<SharedHikesScreen />);

  expect(screen.queryByText("Delade promenader")).toBeNull();
});

it("lists a received walk with who sent it and when", async () => {
  await show();

  expect(screen.getByText("Mottagna promenader")).toBeTruthy();
  expect(screen.getByText("Kvällspromenad")).toBeTruthy();
  expect(screen.getByText("Delad av: bertil")).toBeTruthy();
  expect(screen.getByText("2026-05-04")).toBeTruthy();
});

it("says the shelf is empty rather than showing an empty card", async () => {
  mockGetSharedHikes.mockResolvedValue([]);
  await show();

  expect(screen.getByText("Inga delade promenader här än")).toBeTruthy();
  expect(screen.queryByText("Mottagna promenader")).toBeNull();
});

// Two different empty states again: nothing received, and a search that matched nothing.
it("tells an empty shelf apart from a search that matched nothing", async () => {
  await show();

  fireEvent.press(screen.getByTestId("icon-search"));
  fireEvent.changeText(screen.getByPlaceholderText("Sök bland promenader..."), "finns inte");

  expect(screen.getByText("Inga promenader hittades")).toBeTruthy();
  expect(screen.queryByText("Inga delade promenader här än")).toBeNull();
});

it("keeps the invitations out of the way until there are some", async () => {
  const { unmount } = await show();
  expect(screen.queryByText(/Inkommande/)).toBeNull();
  unmount();

  mockIncoming = { data: incoming(2), isPending: false, isError: false };
  await show();

  expect(screen.getByText("Inkommande (2)")).toBeTruthy();
  expect(screen.getByText("Förfrågan 0")).toBeTruthy();
  expect(screen.getByText("Delad av: vän-1")).toBeTruthy();
});

// The invitation list is a preview: five rows, then a button for the rest.
it("caps the invitation preview and expands on request", async () => {
  mockIncoming = { data: incoming(7), isPending: false, isError: false };
  await show();

  expect(screen.getByText("Förfrågan 4")).toBeTruthy();
  expect(screen.queryByText("Förfrågan 5")).toBeNull();

  fireEvent.press(screen.getByText("Visa alla (7)"));
  expect(screen.getByText("Förfrågan 6")).toBeTruthy();

  fireEvent.press(screen.getByText("Visa färre"));
  expect(screen.queryByText("Förfrågan 5")).toBeNull();
});

it("accepts and rejects the invitation the button belongs to", async () => {
  mockIncoming = { data: incoming(2), isPending: false, isError: false };
  await show();

  fireEvent.press(screen.getAllByLabelText("Acceptera")[1]);
  expect(mockAccept).toHaveBeenCalledWith("in-1");

  fireEvent.press(screen.getAllByLabelText("Avvisa")[0]);
  expect(mockReject).toHaveBeenCalledWith("in-0");
});

// Both buttons on every row go dead while either mutation is in flight.
it("takes no second answer while one is in flight", async () => {
  mockIncoming = { data: incoming(2), isPending: false, isError: false };
  mockMutationsPending = true;
  await show();

  fireEvent.press(screen.getAllByLabelText("Acceptera")[0]);
  fireEvent.press(screen.getAllByLabelText("Avvisa")[0]);

  expect(mockAccept).not.toHaveBeenCalled();
  expect(mockReject).not.toHaveBeenCalled();
});

// The row opens the walk before the decision, and offers the same decision there.
it("opens an invitation for inspection, and answers from inside it", async () => {
  mockIncoming = { data: incoming(2), isPending: false, isError: false };
  await show();

  fireEvent.press(screen.getByText("Förfrågan 1"));
  await flushUntil(() => screen.queryByText("Acceptera"));

  expect(screen.getByText("Acceptera")).toBeTruthy();
  expect(mockGetIncoming).toHaveBeenCalledWith("in-1");

  fireEvent.press(screen.getByText("Acceptera"));
  expect(mockAccept).toHaveBeenCalledWith("in-1");
  expect(screen.queryByText("Avvisa")).toBeNull();
});

// A received walk is already yours: its modal offers sharing and removal, never a decision.
it("opens a received walk without asking for a decision", async () => {
  await show();

  fireEvent.press(screen.getByText("Kvällspromenad"));
  await settle();

  expect(screen.queryByText("Acceptera")).toBeNull();
  expect(screen.getByText("Ta bort")).toBeTruthy();
});

it("offers a retry when the invitations could not be fetched", async () => {
  mockIncoming = { data: undefined, isPending: false, isError: true };
  await show();

  expect(screen.getByText("Kunde inte hämta förfrågningar")).toBeTruthy();
  fireEvent.press(screen.getByText("Försök igen"));

  expect(mockRefetchIncoming).toHaveBeenCalledTimes(1);
});
