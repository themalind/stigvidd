// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { loginReturnPathAtom, userAtom } from "@/atoms/auth-atoms";
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
  usePathname: () => "/events",
}));

jest.mock("@/utils/navigation", () => ({ guardedNavigate: (fn: () => void) => fn() }));

let mockSignedIn = true;
jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: mockSignedIn, logout: jest.fn() }),
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

async function showSignedOut() {
  mockSignedIn = false;
  const rendered = renderWithProviders(<EventsListScreen />);
  await flushUntil(() => screen.queryByText("Fikapromenad") !== null);
  return rendered;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSignedIn = true;
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

  it("loads past events into the list, not a new screen, and pages them on demand", async () => {
    await show();
    expect(mockGetMine).not.toHaveBeenCalledWith(expect.objectContaining({ past: true }));

    mockGetMine.mockImplementation(({ past, cursor }: { past: boolean; cursor?: string }) => {
      if (!past) return Promise.resolve({ items: [], nextCursor: null });
      return Promise.resolve(
        cursor
          ? { items: [summary("old2", "Svampturen")], nextCursor: null }
          : { items: [summary("old1", "Höstpromenaden")], nextCursor: "c1" },
      );
    });
    fireEvent.press(screen.getByTestId("events-past-link"));
    await flushUntil(() => screen.queryByText("Höstpromenaden") !== null);

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByTestId("events-past")).toBeTruthy();
    expect(screen.getAllByTestId("event-past-tag")).toHaveLength(1);
    expect(screen.getByTestId("event-card-old1")).toHaveTextContent(/Avslutat/);

    fireEvent.press(screen.getByTestId("events-past-more"));
    await flushUntil(() => screen.queryByText("Svampturen") !== null);

    expect(screen.getByText("Höstpromenaden")).toBeTruthy();
    expect(screen.queryByTestId("events-past-more")).toBeNull();
  });

  describe("signed out", () => {
    it("lists the open feed without asking for invitations, own events or past events", async () => {
      mockGetEvents.mockResolvedValue({ items: [summary("open", "Fikapromenad")], nextCursor: null });

      await showSignedOut();

      expect(screen.getByText("Fikapromenad")).toBeTruthy();
      expect(screen.queryByTestId("sign-in-prompt")).toBeNull();
      expect(screen.queryByTestId("events-past-link")).toBeNull();
      expect(mockGetInvitations).not.toHaveBeenCalled();
      expect(mockGetMine).not.toHaveBeenCalled();
    });

    it("asks for a login instead of opening the create form, and returns here after it", async () => {
      const { store } = await showSignedOut();

      fireEvent.press(screen.getByTestId("events-create"));
      expect(screen.getByTestId("not-authenticated-dialog")).toBeTruthy();
      expect(mockNavigate).not.toHaveBeenCalledWith("/(tabs)/events/create");

      fireEvent.press(screen.getByText("Logga in"));

      expect(mockNavigate).toHaveBeenCalledWith("/(tabs)/(profile-stack)/login");
      expect(store.get(loginReturnPathAtom)).toBe("/events");
    });
  });
});
