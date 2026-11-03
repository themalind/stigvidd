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
import { BORDER_RADIUS } from "@/constants/constants";
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

async function showMine() {
  await show();
  fireEvent.press(screen.getByTestId("events-tabs-mine"));
  await flushUntil(() => screen.queryByTestId("event-invitations") !== null);
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
  it("starts on Utforska with the open feed, leaving out events one is already in", async () => {
    await show();

    expect(screen.getByTestId("events-tabs-explore")).toBeSelected();
    expect(screen.getByText("Fikapromenad")).toBeTruthy();
    expect(screen.queryByText("Min tur")).toBeNull();
    expect(screen.queryByTestId("event-invitations")).toBeNull();
  });

  it("counts the invitations on the Mina tab", async () => {
    await show();
    await flushUntil(() => screen.queryByTestId("events-tabs-mine-badge") !== null);

    expect(screen.getByTestId("events-tabs-mine-badge")).toHaveTextContent("1");
  });

  it("lists invitations above one's own events under Mina", async () => {
    await showMine();

    expect(screen.getByText(/Hemlig tur/)).toBeTruthy();
    expect(screen.getByText("Dina kommande")).toBeTruthy();
    expect(screen.getByText("Min tur")).toBeTruthy();
    expect(screen.queryByText("Fikapromenad")).toBeNull();
  });

  it("pages one's own events when the Mina list reaches its end", async () => {
    mockGetMine.mockImplementation(({ past, cursor }: { past: boolean; cursor?: string }) => {
      if (past) return Promise.resolve({ items: [], nextCursor: null });
      return Promise.resolve(
        cursor
          ? { items: [summary("mine2", "Andra egna")], nextCursor: null }
          : { items: [summary("mine", "Min tur", { myRole: "Organizer" })], nextCursor: "c1" },
      );
    });
    await showMine();
    await flushUntil(() => screen.queryByText("Min tur") !== null);

    fireEvent(screen.getByTestId("events-list"), "endReached");
    await flushUntil(() => screen.queryByText("Andra egna") !== null);

    expect(screen.getByText("Andra egna")).toBeTruthy();
    expect(screen.getByText("Min tur")).toBeTruthy();
    expect(mockGetMine).toHaveBeenCalledWith(expect.objectContaining({ past: false, cursor: "c1" }));
  });

  it("sets every invitation on its own plate", async () => {
    mockGetInvitations.mockResolvedValue([
      { event: summary("inv", "Hemlig tur"), invitedByNickName: "maja", invitedAt: "2026-11-01T10:00:00Z" },
      { event: summary("inv2", "Andra turen"), invitedByNickName: "olle", invitedAt: "2026-11-01T11:00:00Z" },
    ]);
    await showMine();
    await flushUntil(() => screen.queryByTestId("event-invitation-inv2") !== null);

    for (const id of ["event-invitation-inv", "event-invitation-inv2"]) {
      expect(screen.getByTestId(id)).toHaveStyle({ padding: 12, borderRadius: BORDER_RADIUS });
    }
  });

  it("puts the event's name and the inviter in bold", async () => {
    await showMine();
    await flushUntil(() => screen.queryByTestId("event-invitation-inviter") !== null);

    expect(screen.getByTestId("event-invitation-title")).toHaveTextContent("Hemlig tur");
    expect(screen.getByTestId("event-invitation-title")).toHaveStyle({ fontFamily: "Inter_600SemiBold" });
    expect(screen.getByTestId("event-invitation-inviter")).toHaveTextContent("maja");
    expect(screen.getByTestId("event-invitation-inviter")).toHaveStyle({ fontFamily: "Inter_600SemiBold" });
    expect(screen.getByText(/Inbjuden av/)).toBeTruthy();
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
    await showMine();

    fireEvent.press(screen.getByText("Tacka ja"));
    await flushUntil(() => mockAccept.mock.calls.length > 0);

    expect(mockAccept).toHaveBeenCalledWith("inv");
  });

  it("loads past events only on the Tidigare tab, and pages them at the list's end", async () => {
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
    fireEvent.press(screen.getByTestId("events-tabs-past"));
    await flushUntil(() => screen.queryByText("Höstpromenaden") !== null);

    expect(screen.queryByText("Fikapromenad")).toBeNull();
    expect(screen.getAllByTestId("event-past-tag")).toHaveLength(1);
    expect(screen.getByTestId("event-card-old1")).toHaveTextContent(/Avslutat/);

    fireEvent(screen.getByTestId("events-list"), "endReached");
    await flushUntil(() => screen.queryByText("Svampturen") !== null);

    expect(screen.getByText("Svampturen")).toBeTruthy();
    expect(screen.getByText("Höstpromenaden")).toBeTruthy();
  });

  it("says so when there are no past events", async () => {
    mockGetMine.mockImplementation(() => Promise.resolve({ items: [], nextCursor: null }));
    await show();

    fireEvent.press(screen.getByTestId("events-tabs-past"));
    await flushUntil(() => screen.queryByText("Du har inga tidigare evenemang.") !== null);

    expect(screen.getByText("Du har inga tidigare evenemang.")).toBeTruthy();
  });

  describe("signed out", () => {
    it("lists the open feed without asking for invitations, own events or past events", async () => {
      mockGetEvents.mockResolvedValue({ items: [summary("open", "Fikapromenad")], nextCursor: null });

      await showSignedOut();

      expect(screen.getByText("Fikapromenad")).toBeTruthy();
      expect(screen.queryByTestId("sign-in-prompt")).toBeNull();
      expect(screen.queryByTestId("events-tabs")).toBeNull();
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
