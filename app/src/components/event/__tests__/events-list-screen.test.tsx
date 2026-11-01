// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { userAtom } from "@/atoms/auth-atoms";
import EventsListScreen from "@/components/event/events-list-screen";
import { EventSummary } from "@/data/types";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const mockGetEvents = jest.fn();
const mockGetMine = jest.fn();
const mockGetInvitations = jest.fn();
const mockAccept = jest.fn();
const mockNavigate = jest.fn();

jest.mock("@/api/events", () => ({
  getEvents: (...args: unknown[]) => mockGetEvents(...args),
  getMyEvents: (...args: unknown[]) => mockGetMine(...args),
  getEventInvitations: (...args: unknown[]) => mockGetInvitations(...args),
  acceptEventInvitation: (...args: unknown[]) => mockAccept(...args),
  declineEventInvitation: jest.fn(),
  joinEvent: jest.fn(),
  leaveEvent: jest.fn(),
  markEventInterested: jest.fn(),
  unmarkEventInterested: jest.fn(),
}));

jest.mock("expo-router", () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args), back: jest.fn(), canGoBack: () => true },
}));

jest.mock("@/utils/navigation", () => ({ guardedNavigate: (fn: () => void) => fn() }));

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: true, logout: jest.fn() }),
}));

function summary(identifier: string, title: string, overrides: Partial<EventSummary> = {}): EventSummary {
  return {
    identifier,
    title,
    startsAt: "2026-11-05T17:30:00Z",
    visibility: "Open",
    status: "Published",
    participantCount: 2,
    unreadPostCount: 0,
    ...overrides,
  };
}

async function show() {
  renderWithProviders(<EventsListScreen />, {
    initialAtoms: [[userAtom, { id: "u1", email: "a@b.se", username: "jag" }]],
  });
  await flushUntil(() => screen.queryByText("Fikapromenad") !== null);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetInvitations.mockResolvedValue([
    {
      event: summary("inv", "Hemlig tur", { visibility: "Private" }),
      invitedByNickName: "maja",
      invitedAt: "2026-11-01T10:00:00Z",
    },
  ]);
  mockGetMine.mockResolvedValue({ items: [summary("mine", "Min tur", { myRole: "Organizer" })], nextCursor: null });
  mockGetEvents.mockResolvedValue({
    items: [summary("mine", "Min tur", { myRole: "Organizer" }), summary("open", "Fikapromenad")],
    nextCursor: null,
  });
  mockAccept.mockResolvedValue(undefined);
});

describe("EventsListScreen", () => {
  it("lists invitations, one's own events and the open feed, each event once", async () => {
    await show();

    expect(screen.getByTestId("event-invitations")).toBeTruthy();
    expect(screen.getByText(/Hemlig tur/)).toBeTruthy();
    expect(screen.getAllByText("Min tur")).toHaveLength(1);
    expect(screen.getByText("Fikapromenad")).toBeTruthy();
  });

  it("opens a feed event in the events tab", async () => {
    await show();

    fireEvent.press(screen.getByText("Fikapromenad"));

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: "/(tabs)/events/event/[identifier]",
      params: { identifier: "open" },
    });
  });

  it("opens the create form", async () => {
    await show();

    fireEvent.press(screen.getByTestId("events-create"));

    expect(mockNavigate).toHaveBeenCalledWith("/(tabs)/events/create");
  });

  it("accepts an invitation inline", async () => {
    await show();

    fireEvent.press(screen.getByText("Tacka ja"));
    await flushUntil(() => mockAccept.mock.calls.length > 0);

    expect(mockAccept).toHaveBeenCalledWith("inv");
  });
});
