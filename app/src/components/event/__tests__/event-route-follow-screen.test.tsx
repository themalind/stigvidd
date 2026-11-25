// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import EventRouteFollowScreen from "@/components/event/event-route-follow-screen";
import { EventRoute, HikingEvent } from "@/data/types";
import { logger } from "@/services/logger";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";

const mockGetEvent = jest.fn();
const mockTrack = jest.fn();

jest.mock("@/api/events", () => ({
  getEvent: (...args: unknown[]) => mockGetEvent(...args),
}));

jest.mock("@/services/analytics", () => ({ track: (...args: unknown[]) => mockTrack(...args) }));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ identifier: "e1" }),
}));

jest.mock("@/components/map/route-follow-view", () => ({
  __esModule: true,
  default: () => null,
}));

const NO_PERMISSIONS = {
  canEdit: false,
  canCancel: false,
  canDelete: false,
  canInvite: false,
  canJoin: false,
  canMarkInterested: false,
  canChangeRoles: false,
  canRemoveParticipants: false,
  canPinOrDeletePosts: false,
  canReadBoard: false,
  canPost: false,
};

function hikingEvent(route: EventRoute | null): HikingEvent {
  return {
    identifier: "e1",
    title: "Kvällsvandring Rya åsar",
    description: "Pannlampa behövs.",
    trailIdentifier: null,
    trailName: null,
    startsAt: "2026-11-05T17:30:00Z",
    participantCount: 3,
    interestedCount: 1,
    maxParticipants: 15,
    visibility: "Open",
    allowParticipantInvites: false,
    status: "Published",
    isPast: false,
    organizerNickName: "Artemis",
    hasPendingInvite: false,
    permissions: { ...NO_PERMISSIONS },
    route,
  };
}

const READABLE = JSON.stringify([
  { latitude: 57.7, longitude: 12.9 },
  { latitude: 57.71, longitude: 12.91 },
]);

let warn: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(logger, "warn");
});

afterEach(() => {
  warn.mockRestore();
});

async function show(route: EventRoute | null) {
  mockGetEvent.mockResolvedValue(hikingEvent(route));
  await renderWithProviders(<EventRouteFollowScreen />);
  await flushUntil(() => mockTrack.mock.calls.length > 0);
}

function unreadableWarnings() {
  return warn.mock.calls.filter(([message]) => message === "Event route unreadable");
}

it("counts a followed route without a warning when its path is readable", async () => {
  await show({ kind: "Own", coordinates: READABLE });

  expect(mockTrack).toHaveBeenCalledWith("event.route_followed", { hasRoute: true });
  expect(unreadableWarnings()).toHaveLength(0);
});

it("warns with the event when the route has coordinates that draw nothing", async () => {
  await show({ kind: "Own", coordinates: "inte json" });

  expect(mockTrack).toHaveBeenCalledWith("event.route_followed", { hasRoute: false });
  expect(unreadableWarnings()).toEqual([["Event route unreadable", { eventIdentifier: "e1" }]]);
});

it.each<[string, EventRoute | null]>([
  ["no route", null],
  ["a trail route, whose coordinates the API sends as null", { kind: "Trail", coordinates: null }],
])("counts %s without a warning", async (_label, route) => {
  await show(route);

  expect(mockTrack).toHaveBeenCalledWith("event.route_followed", { hasRoute: false });
  expect(unreadableWarnings()).toHaveLength(0);
});
