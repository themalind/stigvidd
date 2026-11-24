// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import EventRoutePicker from "@/components/event/event-route-picker";
import { lengthOfPath } from "@/components/map/route-trimmer";
import { Hike } from "@/data/types";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const mockGetAllTrails = jest.fn();
const mockGetHikes = jest.fn();

jest.mock("@/api/trails", () => ({ getAllTrails: () => mockGetAllTrails() }));
jest.mock("@/api/hikes", () => ({
  getAllHikesByUserId: (...args: unknown[]) => mockGetHikes(...args),
}));

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: true, logout: jest.fn() }),
}));

jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom({ data: { identifier: "me", nickName: "jag" } }) };
});

const TRAILS = [
  { identifier: "t1", name: "Rya åsar", trailLength: 4.5, city: "Borås", accessibility: false, classification: 1 },
  { identifier: "t2", name: "Kypesjön runt", trailLength: 7, city: "Borås", accessibility: false, classification: 2 },
];

const PATH = [
  { latitude: 57.72, longitude: 12.94 },
  { latitude: 57.721, longitude: 12.941 },
  { latitude: 57.722, longitude: 12.942 },
];

function hike(overrides: Partial<Hike> = {}): Hike {
  return {
    identifier: "h1",
    name: "Kvällspromenad",
    hikeLength: 2.1,
    duration: 1800,
    coordinates: JSON.stringify(PATH),
    createdBy: "me",
    createdAt: "2026-10-01T10:00:00Z",
    images: [],
    ...overrides,
  };
}

const onPick = jest.fn();
const onDismiss = jest.fn();

async function show() {
  return renderWithProviders(<EventRoutePicker visible onDismiss={onDismiss} onPick={onPick} />);
}

async function showHikes() {
  await show();
  await fireEvent.press(screen.getByTestId("event-route-source-hike"));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAllTrails.mockResolvedValue(TRAILS);
  mockGetHikes.mockResolvedValue([]);
});

describe("trails", () => {
  it("picks a trail with its length in metres", async () => {
    await show();
    await flushUntil(() => screen.queryByTestId("event-route-trail-t1") !== null);

    await fireEvent.press(screen.getByTestId("event-route-trail-t1"));

    expect(onPick).toHaveBeenCalledWith({ kind: "trail", identifier: "t1", name: "Rya åsar", lengthMeters: 4500 });
  });

  it("narrows the list to what is searched for", async () => {
    await show();
    await flushUntil(() => screen.queryByTestId("event-route-trail-t2") !== null);

    await fireEvent.changeText(screen.getByTestId("event-route-search"), "Kype");
    await flushUntil(() => screen.queryByTestId("event-route-trail-t1") === null);

    expect(screen.queryByTestId("event-route-trail-t1")).toBeNull();
    expect(screen.queryByTestId("event-route-trail-t2")).not.toBeNull();
  });

  it("says so when no trail matches", async () => {
    await show();
    await flushUntil(() => screen.queryByTestId("event-route-trail-t1") !== null);

    await fireEvent.changeText(screen.getByTestId("event-route-search"), "finns inte");

    await flushUntil(() => screen.queryByText("Inga leder matchar.") !== null);

    expect(screen.queryByText("Inga leder matchar.")).not.toBeNull();
  });

  it("says the trails could not be fetched", async () => {
    mockGetAllTrails.mockRejectedValue(new Error("offline"));
    await show();

    await flushUntil(() => screen.queryByText("Kunde inte hämta lederna.") !== null);

    expect(screen.queryByText("Kunde inte hämta lederna.")).not.toBeNull();
  });
});

describe("own hikes", () => {
  it("lists only hikes that have a route", async () => {
    mockGetHikes.mockResolvedValue([hike(), hike({ identifier: "h2", name: "Utan rutt", coordinates: undefined })]);
    await showHikes();
    await flushUntil(() => screen.queryByTestId("event-route-hike-h1") !== null);

    expect(mockGetHikes).toHaveBeenCalledWith("me");
    expect(screen.queryByTestId("event-route-hike-h1")).not.toBeNull();
    expect(screen.queryByTestId("event-route-hike-h2")).toBeNull();
  });

  it("says so when there is no hike with a route", async () => {
    mockGetHikes.mockResolvedValue([hike({ coordinates: undefined })]);
    await showHikes();

    await flushUntil(() => screen.queryByText("Du har inga sparade hikes med en rutt.") !== null);

    expect(screen.queryByText("Du har inga sparade hikes med en rutt.")).not.toBeNull();
  });

  it("says the hikes could not be fetched", async () => {
    mockGetHikes.mockRejectedValue(new Error("offline"));
    await showHikes();

    await flushUntil(() => screen.queryByText("Kunde inte hämta dina hikes.") !== null);

    expect(screen.queryByText("Kunde inte hämta dina hikes.")).not.toBeNull();
  });

  it("trims a hike before it is used, and uses the whole route by default", async () => {
    mockGetHikes.mockResolvedValue([hike()]);
    await showHikes();
    await flushUntil(() => screen.queryByTestId("event-route-hike-h1") !== null);

    await fireEvent.press(screen.getByTestId("event-route-hike-h1"));
    expect(onPick).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("event-trim-use"));

    expect(onPick).toHaveBeenCalledWith({
      kind: "hike",
      identifier: "h1",
      name: "Kvällspromenad",
      trimStart: null,
      trimEnd: null,
      lengthMeters: lengthOfPath(PATH.map((point) => [point.longitude, point.latitude])),
    });
  });

  it("goes back from trimming to the list", async () => {
    mockGetHikes.mockResolvedValue([hike()]);
    await showHikes();
    await flushUntil(() => screen.queryByTestId("event-route-hike-h1") !== null);
    await fireEvent.press(screen.getByTestId("event-route-hike-h1"));

    await fireEvent.press(screen.getByText("Gå tillbaka"));

    await flushUntil(() => screen.queryByTestId("event-route-hike-h1") !== null);
    expect(screen.queryByTestId("event-route-hike-h1")).not.toBeNull();
    expect(screen.queryByTestId("event-trim-use")).toBeNull();
  });
});
