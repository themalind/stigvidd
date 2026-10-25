// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen, within } from "@testing-library/react-native";
import FriendProfileScreen from "../friend-profile-screen";

const mockRemoveFriend = jest.fn();
const mockBlock = jest.fn();
const mockBack = jest.fn();
const mockSetNote = jest.fn();
const mockNavigate = jest.fn();
let clock = 5_000_000;

let mockFriends: {
  data?: { identifier: string; nickName: string; note?: string | null; friendsSince?: string }[];
  isPending: boolean;
  isError: boolean;
};
let mockShares: unknown[] | undefined = [];
let mockSharesFailed = false;
const mockRefetchShares = jest.fn();

jest.mock("@/atoms/friends-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { friendsAtom: atom(() => ({ ...mockFriends, refetch: jest.fn() })) };
});

jest.mock("@/hooks/shared-hikes/useSharedHikes", () => ({
  useSharedHikes: (select?: (hikes: unknown[]) => unknown) => ({
    data: mockShares && select ? select(mockShares) : mockShares,
    isLoading: false,
    isError: mockSharesFailed,
    refetch: mockRefetchShares,
  }),
}));

let mockOutgoing: unknown[] | undefined = [];
let mockOutgoingFailed = false;
const mockRefetchOutgoing = jest.fn();

jest.mock("@/hooks/shared-hikes/useOutgoingShares", () => ({
  useOutgoingShares: (select?: (hikes: unknown[]) => unknown) => ({
    data: mockOutgoing && select ? select(mockOutgoing) : mockOutgoing,
    isLoading: false,
    isError: mockOutgoingFailed,
    refetch: mockRefetchOutgoing,
  }),
}));

let mockProfile: { publishedTrails: unknown[]; reviews: unknown[] } | undefined = { publishedTrails: [], reviews: [] };
let mockProfileFailed = false;
const mockRefetchProfile = jest.fn();
const mockProfileRequestedFor = jest.fn();

jest.mock("@/hooks/friends/useFriendProfile", () => ({
  useFriendProfile: (identifier: string | undefined) => {
    mockProfileRequestedFor(identifier);
    return {
      data: mockProfile,
      isLoading: false,
      isError: mockProfileFailed,
      refetch: mockRefetchProfile,
    };
  },
}));

let mockMyHikes: unknown[] = [];

jest.mock("@/hooks/hike/useMyHikes", () => ({
  useMyHikes: (select?: (hikes: unknown[]) => unknown) => ({
    data: select ? select(mockMyHikes) : mockMyHikes,
    isLoading: false,
  }),
}));

jest.mock("@/hooks/friends/useFriendMutations", () => ({
  useFriendMutations: () => ({
    removeFriendMutation: { mutate: mockRemoveFriend, isPending: false },
    setNoteMutation: { mutate: mockSetNote, isPending: false },
  }),
}));

jest.mock("@/hooks/friends/useBlockMutations", () => ({
  useBlockMutations: () => ({ blockMutation: { mutate: mockBlock, isPending: false } }),
}));

jest.mock("expo-router", () => ({
  router: { back: () => mockBack(), navigate: (...args: unknown[]) => mockNavigate(...args) },
  useLocalSearchParams: () => ({ identifier: "id-anna" }),
}));

function sharedHike(hikeName: string, sharedByIdentifier: string, sharedAt: string, hikeLength = 5) {
  return {
    hikeIdentifier: `hike-${hikeName}`,
    hikeName,
    hikeLength,
    duration: 3600000,
    coordinates: "",
    sharedByName: sharedByIdentifier,
    sharedByIdentifier,
    sharedAt,
    images: [],
  };
}

async function show() {
  renderWithProviders(<FriendProfileScreen />);
  await flushUntil(() => screen.queryByText("anna") ?? screen.queryByText(/inte bland dina vänner/));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFriends = { data: [{ identifier: "id-anna", nickName: "anna" }], isPending: false, isError: false };
  mockShares = [];
  mockSharesFailed = false;
  mockOutgoing = [];
  mockOutgoingFailed = false;
  mockProfile = { publishedTrails: [], reviews: [] };
  mockProfileFailed = false;
  mockMyHikes = [];
  // keep-comment: guardedNavigate debounces on module state, so the clock only ever moves on, across tests too
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

function sentHike(hikeName: string, isOwnHike: boolean, ...recipients: [string, string][]) {
  return {
    hikeIdentifier: `hike-${hikeName}`,
    hikeName,
    hikeLength: 5,
    duration: 3600000,
    coordinates: "[]",
    isOwnHike,
    lastSharedAt: recipients[0]?.[1] ?? "",
    recipients: recipients.map(([identifier, sharedAt]) => ({ identifier, nickName: identifier, sharedAt })),
  };
}

it("counts both directions in the tabs and lists what you sent on the second", async () => {
  mockShares = [sharedHike("Rya åsar", "id-anna", "2026-08-01T10:00:00Z")];
  mockOutgoing = [
    sentHike("Öresjö runt", true, ["id-anna", "2026-10-03T10:00:00Z"]),
    sentHike("Ramnaparken", true, ["id-bo", "2026-10-20T10:00:00Z"], ["id-anna", "2026-10-21T10:00:00Z"]),
    sentHike("Bara till bo", true, ["id-bo", "2026-10-22T10:00:00Z"]),
  ];
  await show();

  expect(screen.getByText("Från anna · 1")).toBeTruthy();
  expect(screen.getByText("Från dig · 2")).toBeTruthy();
  expect(screen.queryByText("Öresjö runt")).toBeNull();

  fireEvent.press(screen.getByTestId("share-direction-to"));

  const names = screen.getAllByText(/Öresjö runt|Ramnaparken/).map((n) => n.props.children);
  expect(names).toEqual(["Ramnaparken", "Öresjö runt"]);
  expect(screen.queryByText("Bara till bo")).toBeNull();
  expect(screen.queryByText("Rya åsar")).toBeNull();
});

it("opens your own hike from the sent list, and a reshared one as a shared hike", async () => {
  mockOutgoing = [
    sentHike("Egen", true, ["id-anna", "2026-10-03T10:00:00Z"]),
    sentHike("Vidaredelad", false, ["id-anna", "2026-10-02T10:00:00Z"]),
  ];
  await show();
  fireEvent.press(screen.getByTestId("share-direction-to"));

  fireEvent.press(screen.getByText("Egen"));
  fireEvent.press(screen.getByText("Vidaredelad"));

  expect(mockNavigate.mock.calls.map(([arg]) => arg.pathname)).toEqual([
    "/(tabs)/(profile-stack)/hike/[identifier]",
    "/(tabs)/(profile-stack)/shared-hike/[identifier]",
  ]);
});

it("says so when nothing has been sent to the friend", async () => {
  await show();
  fireEvent.press(screen.getByTestId("share-direction-to"));

  expect(screen.getByText("Du har inte delat någon tur med anna än.")).toBeTruthy();
});

it("shows the friend's hikes, newest first, and none from anyone else", async () => {
  mockShares = [
    sharedHike("Rya åsar", "id-anna", "2026-08-01T10:00:00Z"),
    sharedHike("Kypesjön runt", "id-anna", "2026-09-01T10:00:00Z"),
    sharedHike("Öresjö runt", "id-bo", "2026-10-01T10:00:00Z"),
  ];
  await show();

  const names = screen.getAllByText(/Rya åsar|Kypesjön runt/).map((n) => n.props.children);
  expect(names).toEqual(["Kypesjön runt", "Rya åsar"]);
  expect(screen.queryByText("Öresjö runt")).toBeNull();
});

it("shows a hike's first image instead of its route, in both directions", async () => {
  mockShares = [
    {
      ...sharedHike("Rya åsar", "id-anna", "2026-08-01T10:00:00Z"),
      images: [
        { identifier: "i1", imageUrl: "https://media/first.jpg" },
        { identifier: "i2", imageUrl: "https://media/second.jpg" },
      ],
    },
    sharedHike("Utan bild", "id-anna", "2026-07-01T10:00:00Z"),
  ];
  mockOutgoing = [
    { ...sentHike("Öresjö runt", true, ["id-anna", "2026-10-03T10:00:00Z"]), imageUrl: "https://media/sent.jpg" },
  ];
  await show();

  const received = screen.getAllByTestId("hike-row-image");
  expect(received.map((img) => [img.props.source].flat())).toEqual([[{ uri: "https://media/first.jpg" }]]);
  expect(screen.getByText("Utan bild")).toBeTruthy();

  fireEvent.press(screen.getByTestId("share-direction-to"));
  expect([screen.getByTestId("hike-row-image").props.source].flat()).toEqual([{ uri: "https://media/sent.jpg" }]);
});

it("totals what was shared in each direction and together", async () => {
  mockShares = [
    sharedHike("Rya åsar", "id-anna", "2026-08-01T10:00:00Z", 4),
    sharedHike("Kypesjön runt", "id-anna", "2026-09-01T10:00:00Z", 2.5),
  ];
  mockOutgoing = [sentHike("Öresjö runt", true, ["id-anna", "2026-10-03T10:00:00Z"])];
  await show();

  expect(screen.getByTestId("together-total").props.children).toBe("12 km");
  expect(within(screen.getByTestId("together-from-friend")).getByText("2 turer · 6,5 km")).toBeTruthy();
  expect(within(screen.getByTestId("together-from-you")).getByText("1 tur · 5,0 km")).toBeTruthy();
});

it("says so when nothing has been shared, without an empty total", async () => {
  await show();

  expect(screen.getByText("anna har inte delat någon tur med dig än.")).toBeTruthy();
  expect(screen.queryByTestId("together-card")).toBeNull();
});

it("shows how long you have been friends", async () => {
  mockFriends = {
    data: [{ identifier: "id-anna", nickName: "anna", friendsSince: "2026-03-14T10:00:00Z" }],
    isPending: false,
    isError: false,
  };
  await show();

  expect(screen.getByText("Vänner sedan mars 2026")).toBeTruthy();
});

it("lists the friend's published trails and reviews, each opening the trail", async () => {
  mockProfile = {
    publishedTrails: [
      {
        identifier: "trail-hal",
        name: "Hålsjöleden",
        trailLength: 7.8,
        city: "Borås",
        imageUrl: null,
        publishedAt: "2026-10-02T10:00:00Z",
      },
    ],
    reviews: [
      {
        identifier: "rev-1",
        trailIdentifier: "trail-rya",
        trailName: "Rya åsar",
        rating: 4,
        text: "Fin utsikt",
        createdAt: "2026-09-12T10:00:00Z",
      },
    ],
  };
  await show();

  expect(screen.getByText("Leder anna har publicerat")).toBeTruthy();
  expect(screen.getByText("Recensioner av anna · 1")).toBeTruthy();
  expect(screen.getByText("Fin utsikt")).toBeTruthy();

  fireEvent.press(screen.getByTestId("published-trail-row"));
  expect(mockNavigate).toHaveBeenLastCalledWith({
    pathname: "/(tabs)/(profile-stack)/trail/[identifier]",
    params: { identifier: "trail-hal" },
  });

  fireEvent.press(screen.getByTestId("friend-review-row"));
  expect(mockNavigate).toHaveBeenLastCalledWith({
    pathname: "/(tabs)/(profile-stack)/trail/[identifier]",
    params: { identifier: "trail-rya" },
  });
});

it("hides published trails when there are none, but says there are no reviews", async () => {
  await show();

  expect(screen.queryByTestId("published-trails")).toBeNull();
  expect(screen.getByText("anna har inte recenserat någon led än.")).toBeTruthy();
});

it("picks one of your hikes and opens it ready to share with the friend", async () => {
  mockMyHikes = [
    {
      identifier: "h-old",
      name: "Gammal tur",
      hikeLength: 3,
      duration: 1,
      createdAt: "2026-01-01T10:00:00Z",
      images: [],
    },
    { identifier: "h-new", name: "Ny tur", hikeLength: 4, duration: 1, createdAt: "2026-10-01T10:00:00Z", images: [] },
  ];
  await show();

  fireEvent.press(screen.getByTestId("share-hike-with"));
  await flushUntil(() => screen.queryByTestId("pick-hike-h-new"));
  const names = screen.getAllByText(/Gammal tur|Ny tur/).map((n) => n.props.children);
  expect(names).toEqual(["Ny tur", "Gammal tur"]);

  fireEvent.press(screen.getByTestId("pick-hike-h-new"));
  expect(mockNavigate).toHaveBeenCalledWith({
    pathname: "/(tabs)/(profile-stack)/hike/[identifier]",
    params: { identifier: "h-new", shareWith: "anna" },
  });
});

it("removes the friend only after confirming, then leaves the profile", async () => {
  await show();

  fireEvent.press(screen.getByTestId("remove-friend"));
  expect(screen.getByText(/avsluta din vänskap med anna/)).toBeTruthy();
  expect(mockRemoveFriend).not.toHaveBeenCalled();

  const confirm = screen.getAllByText("Ta bort").at(-1);
  if (!confirm) throw new Error("expected a confirm button");
  fireEvent.press(confirm);

  expect(mockRemoveFriend).toHaveBeenCalledWith("id-anna", expect.anything());
  const options = mockRemoveFriend.mock.calls[0][1];
  options.onSuccess();
  expect(mockBack).toHaveBeenCalled();
});

it("blocks the friend only after confirming", async () => {
  await show();

  fireEvent.press(screen.getByTestId("block-friend"));
  expect(screen.getByText("Blockera anna?")).toBeTruthy();
  expect(mockBlock).not.toHaveBeenCalled();

  const confirm = screen.getAllByText("Blockera").at(-1);
  if (!confirm) throw new Error("expected a confirm button");
  fireEvent.press(confirm);

  expect(mockBlock).toHaveBeenCalledWith("id-anna", expect.anything());
});

it("offers to add a note when the friend has none", async () => {
  await show();

  expect(screen.queryByTestId("friend-note")).toBeNull();
  fireEvent.press(screen.getByTestId("add-note"));
  fireEvent.changeText(screen.getByTestId("note-input"), "  Från jobbet  ");
  fireEvent.press(screen.getByTestId("note-save"));

  expect(mockSetNote).toHaveBeenCalledWith({ identifier: "id-anna", note: "Från jobbet" });
});

it("shows the note and lets it be removed", async () => {
  mockFriends = {
    data: [{ identifier: "id-anna", nickName: "anna", note: "Från jobbet" }],
    isPending: false,
    isError: false,
  };
  await show();

  expect(screen.getByText("Från jobbet")).toBeTruthy();
  expect(screen.queryByTestId("add-note")).toBeNull();
  fireEvent.press(screen.getByTestId("edit-note"));
  fireEvent.press(screen.getByTestId("note-remove"));

  expect(mockSetNote).toHaveBeenCalledWith({ identifier: "id-anna", note: null });
});

it("offers a retry for the trails and reviews when the profile fails, and still shows the rest", async () => {
  mockProfile = undefined;
  mockProfileFailed = true;
  await show();

  expect(screen.getAllByText("Kunde inte hämta profilen")).toHaveLength(2);
  expect(screen.getByTestId("share-hike-with")).toBeTruthy();
  fireEvent.press(within(screen.getByTestId("friend-reviews")).getByText("Försök igen"));
  expect(mockRefetchProfile).toHaveBeenCalledTimes(1);
});

it("keeps showing a profile it already has when a refetch fails", async () => {
  mockProfileFailed = true;
  await show();

  expect(screen.queryByText("Kunde inte hämta profilen")).toBeNull();
  expect(screen.getByText("anna har inte recenserat någon led än.")).toBeTruthy();
});

it("offers a retry when the friend's hikes fail to load", async () => {
  mockShares = undefined;
  mockSharesFailed = true;
  await show();

  const section = screen.getByTestId("friend-shares");
  expect(within(section).getByText("Kunde inte hämta delade turer")).toBeTruthy();
  fireEvent.press(within(section).getByText("Försök igen"));
  expect(mockRefetchShares).toHaveBeenCalledTimes(1);
});

it("offers a retry when what you sent fails to load", async () => {
  mockOutgoing = undefined;
  mockOutgoingFailed = true;
  await show();

  fireEvent.press(screen.getByText("Från dig"));
  const section = screen.getByTestId("sent-shares");
  expect(within(section).getByText("Kunde inte hämta delade turer")).toBeTruthy();
  fireEvent.press(within(section).getByText("Försök igen"));
  expect(mockRefetchOutgoing).toHaveBeenCalledTimes(1);
});

it("shows no profile while the friend list is still loading", () => {
  mockFriends = { data: undefined, isPending: true, isError: false };
  renderWithProviders(<FriendProfileScreen />);

  expect(screen.queryByText(/inte bland dina vänner/)).toBeNull();
  expect(screen.queryByTestId("remove-friend")).toBeNull();
});

it("says the person is no longer a friend rather than showing a stale profile", async () => {
  mockFriends = { data: [], isPending: false, isError: false };
  await show();

  expect(screen.getByText(/inte bland dina vänner/)).toBeTruthy();
  expect(screen.queryByTestId("remove-friend")).toBeNull();
});

it("does not ask for the profile of someone who is no longer a friend", async () => {
  mockFriends = { data: [], isPending: false, isError: false };
  await show();

  expect(mockProfileRequestedFor).toHaveBeenCalled();
  expect(mockProfileRequestedFor).not.toHaveBeenCalledWith("id-anna");
});

it("asks for the profile of a friend", async () => {
  await show();

  expect(mockProfileRequestedFor).toHaveBeenCalledWith("id-anna");
});
