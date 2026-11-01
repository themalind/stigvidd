// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { userAtom } from "@/atoms/auth-atoms";
import EventDetailsScreen from "@/components/event/event-details-screen";
import { EVENTS_TAB_ROUTES } from "@/components/event/event-routes";
import { EventParticipants, HikingEvent } from "@/data/types";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const mockGetEvent = jest.fn();
const mockGetParticipants = jest.fn();
const mockJoin = jest.fn();
const mockAccept = jest.fn();
const mockRemove = jest.fn();
const mockNavigate = jest.fn();
const mockBack = jest.fn();

jest.mock("@/api/events", () => ({
  getEvent: (...args: unknown[]) => mockGetEvent(...args),
  getEventParticipants: (...args: unknown[]) => mockGetParticipants(...args),
  joinEvent: (...args: unknown[]) => mockJoin(...args),
  acceptEventInvitation: (...args: unknown[]) => mockAccept(...args),
  removeEventParticipant: (...args: unknown[]) => mockRemove(...args),
  leaveEvent: jest.fn(),
  markEventInterested: jest.fn(),
  unmarkEventInterested: jest.fn(),
  declineEventInvitation: jest.fn(),
  cancelEvent: jest.fn(),
  deleteEvent: jest.fn(),
  setEventParticipantRole: jest.fn(),
  revokeEventInvitation: jest.fn(),
  inviteToEvent: jest.fn(),
}));

jest.mock("@/utils/navigation", () => ({ guardedNavigate: (fn: () => void) => fn() }));

const mockTrailCoordinates = jest.fn();
jest.mock("@/api/trails", () => ({
  getCoordinatesByTrailIdentifier: (...args: unknown[]) => mockTrailCoordinates(...args),
}));

jest.mock("@/api/friends", () => ({ getFriends: () => Promise.resolve([]), searchUsers: () => Promise.resolve([]) }));

jest.mock("@/api/content-reports", () => ({
  getReportReasons: () => Promise.resolve(["Spam"]),
  createContentReport: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ identifier: "e1" }),
  router: {
    navigate: (...args: unknown[]) => mockNavigate(...args),
    back: mockBack,
    canGoBack: () => true,
  },
}));

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: true, logout: jest.fn() }),
}));

jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom({ data: { identifier: "me", nickName: "jag" } }) };
});

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

function hikingEvent(overrides: Partial<HikingEvent> = {}): HikingEvent {
  return {
    identifier: "e1",
    title: "Kvällsvandring Rya åsar",
    description: "Pannlampa behövs.",
    trailIdentifier: "t1",
    trailName: "Rya åsar runt",
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
    ...overrides,
  };
}

function outsiders(): EventParticipants {
  return { participantCount: 3, interestedCount: 1, participants: null, invited: null };
}

async function show(event: HikingEvent | Error, participants: EventParticipants = outsiders()) {
  if (event instanceof Error) mockGetEvent.mockRejectedValue(event);
  else mockGetEvent.mockResolvedValue(event);
  mockGetParticipants.mockResolvedValue(participants);
  const rendered = renderWithProviders(<EventDetailsScreen routes={EVENTS_TAB_ROUTES} />, {
    initialAtoms: [[userAtom, { id: "u1", email: "a@b.se", username: "jag" }]],
  });
  await flushUntil(() => mockGetEvent.mock.calls.length > 0 && !screen.queryByTestId("loading-indicator"));
  return rendered;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockJoin.mockResolvedValue(undefined);
  mockAccept.mockResolvedValue(undefined);
  mockRemove.mockResolvedValue(undefined);
  mockTrailCoordinates.mockResolvedValue({
    coordinates: JSON.stringify([
      { latitude: 57.72, longitude: 12.94 },
      { latitude: 57.73, longitude: 12.95 },
    ]),
  });
});

describe("EventDetailsScreen", () => {
  it("shows the gone screen, not the generic error, when the event answers 404", async () => {
    await show(new ApiError("HTTP error: getEvent: 404", 404, "event_gone"));

    await flushUntil(() => screen.queryByTestId("event-gone") !== null);
    expect(screen.getByText("Evenemanget finns inte längre")).toBeTruthy();
  });

  it("joins an open event from the action bar", async () => {
    await show(hikingEvent({ permissions: { ...NO_PERMISSIONS, canJoin: true, canMarkInterested: true } }));
    await flushUntil(() => screen.queryByText("Gå med") !== null);

    fireEvent.press(screen.getByText("Gå med"));
    await flushUntil(() => mockJoin.mock.calls.length > 0);

    expect(mockJoin).toHaveBeenCalledWith("e1");
  });

  it("puts Accept in place of Join for an invitee", async () => {
    await show(
      hikingEvent({ visibility: "Private", hasPendingInvite: true, permissions: { ...NO_PERMISSIONS, canJoin: true } }),
    );
    await flushUntil(() => screen.queryByTestId("event-invite-banner") !== null);

    expect(screen.queryByTestId("event-action-bar")).toBeNull();
    fireEvent.press(screen.getByText("Tacka ja"));
    await flushUntil(() => mockAccept.mock.calls.length > 0);
    expect(mockAccept).toHaveBeenCalledWith("e1");
  });

  it("shows the cancelled banner and no join", async () => {
    await show(hikingEvent({ status: "Cancelled" }));
    await flushUntil(() => screen.queryByTestId("event-cancelled-banner") !== null);

    expect(screen.queryByText("Gå med")).toBeNull();
  });

  it("locks the board for someone who has not joined", async () => {
    await show(hikingEvent());
    await flushUntil(() => screen.queryByTestId("event-board-link") !== null);

    expect(screen.getByText("Gå med för att läsa och skriva")).toBeTruthy();
    fireEvent.press(screen.getByTestId("event-board-link"));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("draws the linked trail on the map and opens the trail's follow view from it", async () => {
    await show(hikingEvent());
    await flushUntil(() => screen.queryByTestId("route-preview") !== null);

    expect(mockTrailCoordinates).toHaveBeenCalledWith("t1");
    fireEvent.press(screen.getByLabelText("Visa kartvy"));
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: "/(tabs)/events/follow/[identifier]",
      params: { identifier: "t1" },
    });
  });

  it("opens an own route in the event's own follow view", async () => {
    const coordinates = JSON.stringify([
      { latitude: 57.72, longitude: 12.94 },
      { latitude: 57.73, longitude: 12.95 },
    ]);
    await show(
      hikingEvent({ trailIdentifier: null, trailName: null, route: { kind: "Own", lengthMeters: 1200, coordinates } }),
    );
    await flushUntil(() => screen.queryByTestId("route-preview") !== null);

    fireEvent.press(screen.getByLabelText("Visa kartvy"));
    expect(mockTrailCoordinates).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: "/(tabs)/events/route/[identifier]",
      params: { identifier: "e1" },
    });
  });

  it("shows a meeting point alone on a map that opens nothing", async () => {
    await show(
      hikingEvent({
        trailIdentifier: null,
        trailName: null,
        meetingPointLongitude: 12.94,
        meetingPointLatitude: 57.72,
        meetingPointName: "Parkeringen",
      }),
    );
    await flushUntil(() => screen.queryByTestId("route-preview") !== null);

    expect(screen.getByTestId("route-preview")).toBeTruthy();
    expect(screen.queryByLabelText("Visa kartvy")).toBeNull();
  });

  it("offers sharing for an open event only", async () => {
    await show(hikingEvent());
    await flushUntil(() => screen.queryByTestId("event-board-link") !== null);
    expect(screen.queryByTestId("event-share")).not.toBeNull();

    await show(hikingEvent({ visibility: "Private" }));
    await flushUntil(() => screen.queryByTestId("event-board-link") !== null);
    expect(screen.queryByTestId("event-share")).toBeNull();
  });

  it("opens the edit form in the same stack from the manage menu", async () => {
    await show(hikingEvent({ myRole: "CoHost", permissions: { ...NO_PERMISSIONS, canEdit: true } }));
    await flushUntil(() => screen.queryByTestId("event-manage-menu") !== null);

    fireEvent.press(screen.getByTestId("event-manage-menu"));
    await flushUntil(() => screen.queryByText("Redigera") !== null);
    fireEvent.press(screen.getByText("Redigera"));

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: "/(tabs)/events/edit/[identifier]",
      params: { identifier: "e1" },
    });
  });

  it("lists participants once joined, and lets a host remove one after confirming", async () => {
    await show(
      hikingEvent({
        myRole: "Organizer",
        myStatus: "Joined",
        permissions: { ...NO_PERMISSIONS, canRemoveParticipants: true, canReadBoard: true },
      }),
      {
        participantCount: 2,
        interestedCount: 0,
        participants: [
          { userIdentifier: "me", nickName: "jag", role: "Organizer", joinedAt: "2026-10-01T10:00:00Z" },
          { userIdentifier: "u2", nickName: "bertil", role: "Participant", joinedAt: "2026-10-02T10:00:00Z" },
        ],
        invited: [],
      },
    );
    await flushUntil(() => screen.queryByTestId("event-participant-bertil") !== null);

    expect(screen.queryByTestId("event-participant-menu-jag")).toBeNull();
    fireEvent.press(screen.getByTestId("event-participant-menu-bertil"));
    await flushUntil(() => screen.queryByText("Ta bort från evenemanget") !== null);
    fireEvent.press(screen.getByText("Ta bort från evenemanget"));
    await flushUntil(() => screen.queryByTestId("event-remove-participant-dialog") !== null);
    expect(mockRemove).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("event-remove-participant-dialog-confirm"));
    await flushUntil(() => mockRemove.mock.calls.length > 0);
    expect(mockRemove).toHaveBeenCalledWith("e1", "u2");
  });
});
