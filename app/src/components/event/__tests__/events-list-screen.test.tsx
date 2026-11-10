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
import { act, fireEvent, screen } from "@testing-library/react-native";

// Explicit, so the component and requireMock share one instance of the root manual mock.
jest.mock("react-native-paper-dates");
const { mockPickers } = jest.requireMock<{
  mockPickers: { date: { onConfirm: (range: { startDate?: Date; endDate?: Date }) => void } | null };
}>("react-native-paper-dates");

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

// The pause before a search is sent has its own test; here the text goes out at once. keep-comment: why the debounce is identity
jest.mock("@/hooks/useDebouncedValue", () => ({ useDebouncedValue: <T,>(value: T) => value }));

let mockLocation: { latitude: number; longitude: number } | null = null;
jest.mock("@/hooks/location/useUserLocation", () => ({ useRealUserLocation: () => mockLocation }));

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
  await renderWithProviders(<EventsListScreen />, {
    initialAtoms: [[userAtom, { id: "u1", email: "a@b.se", username: "jag" }]],
  });
  await flushUntil(() => screen.queryByText("Fikapromenad") !== null);
}

async function showMine() {
  await show();
  await fireEvent.press(screen.getByTestId("events-tabs-mine"));
  await flushUntil(() => screen.queryByTestId("event-invitations") !== null);
}

async function showSignedOut() {
  mockSignedIn = false;
  const rendered = await renderWithProviders(<EventsListScreen />);
  await flushUntil(() => screen.queryByText("Fikapromenad") !== null);
  return rendered;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSignedIn = true;
  mockLocation = null;
  mockGetInvitations.mockResolvedValue([
    {
      event: summary("inv", "Hemlig tur", { visibility: "Private" }),
      invitedByNickName: "maja",
      invitedAt: "2026-11-01T10:00:00Z",
    },
  ]);
  mockGetMine.mockResolvedValue({ items: [summary("mine", "Min tur", { myRole: "Organizer" })], nextCursor: null });
  mockGetEvents.mockResolvedValue({ items: [summary("open", "Fikapromenad")], nextCursor: null });
  mockAccept.mockResolvedValue(undefined);
});

describe("EventsListScreen", () => {
  it("starts on Utforska with the open feed, which the server sends without events one is already in", async () => {
    await show();

    expect(mockGetEvents).toHaveBeenCalledWith(expect.objectContaining({ excludeMine: true }));
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

    await fireEvent(screen.getByTestId("events-list"), "endReached");
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

    await fireEvent.press(screen.getByText("Fikapromenad"));

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: "/(tabs)/events/event/[identifier]",
      params: { identifier: "open" },
    });
  });

  it("opens the create form", async () => {
    await show();

    await fireEvent.press(screen.getByTestId("events-create"));

    expect(mockNavigate).toHaveBeenCalledWith("/(tabs)/events/create");
  });

  it("accepts an invitation inline", async () => {
    await showMine();

    await fireEvent.press(screen.getByText("Tacka ja"));
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
    await fireEvent.press(screen.getByTestId("events-tabs-past"));
    await flushUntil(() => screen.queryByText("Höstpromenaden") !== null);

    expect(screen.queryByText("Fikapromenad")).toBeNull();
    expect(screen.getAllByTestId("event-past-tag")).toHaveLength(1);
    expect(screen.getByTestId("event-card-old1")).toHaveTextContent(/Avslutat/);

    await fireEvent(screen.getByTestId("events-list"), "endReached");
    await flushUntil(() => screen.queryByText("Svampturen") !== null);

    expect(screen.getByText("Svampturen")).toBeTruthy();
    expect(screen.getByText("Höstpromenaden")).toBeTruthy();
  });

  it("says so when there are no past events", async () => {
    mockGetMine.mockImplementation(() => Promise.resolve({ items: [], nextCursor: null }));
    await show();

    await fireEvent.press(screen.getByTestId("events-tabs-past"));
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

      await fireEvent.press(screen.getByTestId("events-create"));
      expect(screen.getByTestId("not-authenticated-dialog")).toBeTruthy();
      expect(mockNavigate).not.toHaveBeenCalledWith("/(tabs)/events/create");

      await fireEvent.press(screen.getByText("Logga in"));

      expect(mockNavigate).toHaveBeenCalledWith("/(tabs)/(profile-stack)/login");
      expect(store.get(loginReturnPathAtom)).toBe("/events");
    });
  });

  describe("search and filters", () => {
    const lastFeedQuery = () => mockGetEvents.mock.lastCall?.[0];

    async function settleOn(check: () => boolean) {
      await flushUntil(check);
      expect(check()).toBe(true);
    }

    it("sends the typed text to the server, trimmed", async () => {
      await show();

      await fireEvent.changeText(screen.getByTestId("events-search"), "  kype ");

      await settleOn(() => lastFeedQuery()?.search === "kype");
      expect(lastFeedQuery()).toEqual(expect.objectContaining({ excludeMine: true, search: "kype" }));
    });

    it("sends a weekend window from the quick filter and counts it on the filter button", async () => {
      await show();

      await fireEvent.press(screen.getByTestId("events-chip-weekend"));

      await settleOn(() => lastFeedQuery()?.from !== undefined);
      const { from, to } = lastFeedQuery();
      expect(new Date(to).getTime() - new Date(from).getTime()).toBeGreaterThanOrEqual(23 * 3600 * 1000);
      expect(new Date(from).getDay()).toBe(new Date().getDay() === 0 ? 0 : 6);
      expect(screen.getByTestId("events-filter-button-count")).toHaveTextContent("1");
      expect(screen.getByTestId("events-chip-weekend")).toBeSelected();
    });

    it("offers near me only with a position, and then sorts by distance", async () => {
      await show();
      expect(screen.queryByTestId("events-chip-near-me")).toBeNull();

      await screen.unmount();
      mockLocation = { latitude: 57.72106, longitude: 12.93987 };
      await show();
      await fireEvent.press(screen.getByTestId("events-chip-near-me"));

      await settleOn(() => lastFeedQuery()?.sort === "Distance");
      expect(lastFeedQuery()).toEqual(
        expect.objectContaining({ lat: 57.721, lon: 12.94, radiusKm: 25, sort: "Distance" }),
      );
    });

    it("says nothing matches, and clearing brings the plain feed back", async () => {
      mockGetEvents.mockImplementation((query: { search?: string }) =>
        Promise.resolve({ items: query.search ? [] : [summary("open", "Fikapromenad")], nextCursor: null }),
      );
      await show();

      await fireEvent.changeText(screen.getByTestId("events-search"), "kajak");
      await settleOn(() => screen.queryByTestId("events-no-matches") !== null);
      expect(screen.getByText("Inga evenemang matchar")).toBeTruthy();

      await fireEvent.press(screen.getByTestId("events-clear-filters"));
      await settleOn(() => screen.queryByText("Fikapromenad") !== null);
      expect(lastFeedQuery()?.search).toBeUndefined();
      expect(screen.queryByTestId("events-clear-filters")).toBeNull();
    });

    it("searches past events too, without the date filters", async () => {
      mockGetMine.mockImplementation((query: { past?: boolean }) =>
        Promise.resolve({ items: query.past ? [summary("old", "Gammal tur")] : [], nextCursor: null }),
      );
      await show();
      await fireEvent.press(screen.getByTestId("events-tabs-past"));
      await settleOn(() => screen.queryByText("Gammal tur") !== null);

      expect(screen.queryByTestId("events-chip-today")).toBeNull();
      await fireEvent.changeText(screen.getByTestId("events-search"), "gammal");

      await settleOn(() => mockGetMine.mock.lastCall?.[0]?.search === "gammal");
      expect(mockGetMine.mock.lastCall?.[0]).toEqual(expect.objectContaining({ past: true, search: "gammal" }));
      expect(mockGetMine.mock.lastCall?.[0]?.from).toBeUndefined();
    });

    it("does not count a date choice on the past tab, where it does not apply", async () => {
      await show();
      await fireEvent.press(screen.getByTestId("events-chip-weekend"));
      await settleOn(() => screen.queryByTestId("events-filter-button-count") !== null);

      await fireEvent.press(screen.getByTestId("events-tabs-past"));
      await settleOn(() => mockGetMine.mock.lastCall?.[0]?.past === true);

      expect(screen.queryByTestId("events-filter-button-count")).toBeNull();
      expect(screen.queryByTestId("events-clear-filters")).toBeNull();
      expect(screen.queryByTestId("events-no-matches")).toBeNull();
    });

    it("clears the filters from the sheet but keeps the typed text", async () => {
      await show();
      await fireEvent.press(screen.getByTestId("events-chip-spots"));
      await settleOn(() => lastFeedQuery()?.onlyWithSpots === true);
      await fireEvent.changeText(screen.getByTestId("events-search"), "kype");
      await settleOn(() => lastFeedQuery()?.search === "kype");

      await fireEvent.press(screen.getByTestId("events-filter-button"));
      await fireEvent.press(screen.getByTestId("filter-sheet-clear"));

      await settleOn(() => lastFeedQuery()?.onlyWithSpots === undefined);
      expect(lastFeedQuery()?.search).toBe("kype");
      expect(screen.getByTestId("events-search")).toHaveProp("value", "kype");
    });

    it("applies the length, route and spots choices from the filter sheet", async () => {
      await show();
      await fireEvent.press(screen.getByTestId("events-filter-button"));

      await fireEvent.press(screen.getByTestId("event-length-mid"));
      await fireEvent.press(screen.getByTestId("event-route-own"));
      await fireEvent(screen.getByTestId("event-filter-spots"), "valueChange", true);

      await settleOn(() => lastFeedQuery()?.onlyWithSpots === true);
      expect(lastFeedQuery()).toEqual(
        expect.objectContaining({ minLengthKm: 5, maxLengthKm: 15, routeKind: "Own", onlyWithSpots: true }),
      );
      expect(screen.getByTestId("events-filter-button-count")).toHaveTextContent("3");
    });

    it("sends a picked date range with its last day included", async () => {
      await show();
      await fireEvent.press(screen.getByTestId("events-filter-button"));
      await fireEvent.press(screen.getByTestId("event-when-custom"));

      const picker = mockPickers.date;
      if (!picker) throw new Error("expected the range picker to open");
      await act(async () => {
        picker.onConfirm({ startDate: new Date(2030, 4, 10, 12), endDate: new Date(2030, 4, 12) });
      });

      await settleOn(() => lastFeedQuery()?.from !== undefined);
      expect(lastFeedQuery()).toEqual(
        expect.objectContaining({
          from: new Date(2030, 4, 10).toISOString(),
          to: new Date(2030, 4, 13).toISOString(),
        }),
      );
      expect(screen.getByText(/10 maj – 12 maj/)).toBeTruthy();
    });
  });
});
