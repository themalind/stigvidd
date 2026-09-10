// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import FriendsScreen from "../friends";

type Row = { identifier: string; nickName: string };

const mockAccept = jest.fn();
const mockReject = jest.fn();
const mockSendRequest = jest.fn();
const mockRemoveFriend = jest.fn();
const mockGetOutgoing = jest.fn();
const mockRefetchFriends = jest.fn();
const mockRefetchIncoming = jest.fn();

let mockFriends: { data?: Row[]; isPending: boolean; isError: boolean };
let mockIncoming: { data?: unknown[]; isPending: boolean; isError: boolean };
let mockSearch: { data?: Row[]; isPending: boolean; isError: boolean };
let mockSearchQueries: string[] = [];
const mockSearchAtoms = new Map<string, unknown>();
let mockRemovePending = false;

jest.mock("@/atoms/friends-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return {
    friendsAtom: atom(() => ({ ...mockFriends, refetch: mockRefetchFriends })),
    incomingRequestsAtom: atom(() => ({ ...mockIncoming, refetch: mockRefetchIncoming })),
    // The family caches per query key; a fresh atom on every render resubscribes and loops.
    userSearchAtomFamily: (query: string) => {
      mockSearchQueries.push(query);
      const cached = mockSearchAtoms.get(query);
      if (cached) return cached;
      const created = atom(() => mockSearch);
      mockSearchAtoms.set(query, created);
      return created;
    },
  };
});

jest.mock("@/hooks/friends/useFriendMutations", () => ({
  useFriendMutations: () => ({
    acceptMutation: { mutate: mockAccept, isPending: false },
    rejectMutation: { mutate: mockReject, isPending: false },
    sendRequestMutation: { mutate: mockSendRequest, isPending: false },
    removeFriendMutation: { mutate: mockRemoveFriend, isPending: mockRemovePending },
  }),
}));

jest.mock("@/api/friends", () => ({
  getOutgoingRequests: () => mockGetOutgoing(),
}));

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), navigate: jest.fn() },
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

function friend(nickName: string, identifier = `id-${nickName}`): Row {
  return { identifier, nickName };
}

function incomingRequest(nickName: string) {
  return { requesterIdentifier: `id-${nickName}`, requesterNickName: nickName };
}

function outgoingRequest(nickName: string) {
  return { receiverIdentifier: `id-${nickName}`, receiverNickName: nickName };
}

async function show() {
  const rendered = renderWithProviders(<FriendsScreen />);
  // Not the title: the failed list carries "Vänner" too, and queryByText throws on two matches.
  await flushUntil(() => screen.queryByPlaceholderText("Sök användare"));
  return rendered;
}

function searchFor(query: string) {
  fireEvent.changeText(screen.getByPlaceholderText("Sök användare"), query);
}

// Each action button names itself, since the icon inside is hidden from accessibility.
function actionButton(label: string, index = 0) {
  return screen.getAllByLabelText(label)[index];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchQueries = [];
  mockSearchAtoms.clear();
  mockRemovePending = false;
  mockFriends = { data: [friend("bertil"), friend("cissi")], isPending: false, isError: false };
  mockIncoming = { data: [], isPending: false, isError: false };
  mockSearch = { data: [], isPending: false, isError: false };
  mockGetOutgoing.mockResolvedValue([]);
});

it("lists the friends there are", async () => {
  await show();

  expect(screen.getByText("Vänner (2)")).toBeTruthy();
  expect(screen.getByText("bertil")).toBeTruthy();
  expect(screen.getByText("cissi")).toBeTruthy();
});

it("says so when there are none", async () => {
  mockFriends = { data: [], isPending: false, isError: false };
  await show();

  expect(screen.getByText(/Du har inga vänner än/)).toBeTruthy();
});

// One or two characters would ask the server about nearly every user, on every keystroke.
it("does not search until the query is worth a request", async () => {
  await show();

  searchFor("be");
  expect(screen.queryByText("Sökresultat")).toBeNull();

  mockSearch = { data: [friend("bengt")], isPending: false, isError: false };
  searchFor("ber");

  expect(screen.getByText("Sökresultat")).toBeTruthy();
  expect(screen.getByText("bengt")).toBeTruthy();
});

it("sends a request to the user that was picked", async () => {
  mockSearch = { data: [friend("bengt")], isPending: false, isError: false };
  await show();
  searchFor("ber");

  fireEvent.press(actionButton("Skicka vänförfrågan"));

  expect(mockSendRequest).toHaveBeenCalledWith("bengt");
});

// A result that is already a friend, or already asked, does not offer to ask again.
it("offers no second request to someone already asked or already a friend", async () => {
  mockSearch = { data: [friend("bertil"), friend("dora")], isPending: false, isError: false };
  mockGetOutgoing.mockResolvedValue([outgoingRequest("dora")]);
  await show();
  searchFor("bertil");

  // The two states that replace the button are plain icons, with no action to name.
  expect(screen.getByTestId("icon-account-check", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByTestId("icon-clock-outline", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByLabelText("Skicka vänförfrågan")).toBeNull();
});

it("answers an incoming request with the requester's own identifier", async () => {
  mockIncoming = { data: [incomingRequest("erik"), incomingRequest("frida")], isPending: false, isError: false };
  await show();

  fireEvent.press(actionButton("Acceptera vänförfrågan", 1));
  expect(mockAccept).toHaveBeenCalledWith("id-frida");

  fireEvent.press(actionButton("Avvisa vänförfrågan", 0));
  expect(mockReject).toHaveBeenCalledWith("id-erik");
});

// Removing a friend is confirmed, and the dialog names the person being removed.
it("names the friend it is about to remove, and removes only on confirmation", async () => {
  await show();

  fireEvent.press(actionButton("Ta bort vän", 1));
  expect(screen.getByText(/avsluta din vänskap med cissi/)).toBeTruthy();
  expect(mockRemoveFriend).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText("Avbryt"));
  expect(mockRemoveFriend).not.toHaveBeenCalled();

  fireEvent.press(actionButton("Ta bort vän", 0));
  // The dialog repeats the label of the button that opened it; the confirm is the last.
  fireEvent.press(screen.getAllByText("Ta bort").at(-1)!);

  expect(mockRemoveFriend).toHaveBeenCalledWith("id-bertil");
});

// Every list is a preview of five with the rest behind a button.
it("caps each list at five rows and expands on request", async () => {
  mockFriends = {
    data: Array.from({ length: 7 }, (_, i) => friend(`vän-${i}`)),
    isPending: false,
    isError: false,
  };
  await show();

  expect(screen.getByText("vän-4")).toBeTruthy();
  expect(screen.queryByText("vän-5")).toBeNull();

  fireEvent.press(screen.getByText("Visa alla (7)"));
  expect(screen.getByText("vän-6")).toBeTruthy();

  fireEvent.press(screen.getByText("Visa färre"));
  expect(screen.queryByText("vän-5")).toBeNull();
});

// Each list fetches on its own, so one failing must not take the others with it.
it("keeps a failed list to itself, and offers it a retry", async () => {
  mockFriends = { data: undefined, isPending: false, isError: true };
  mockIncoming = { data: [incomingRequest("erik")], isPending: false, isError: false };
  await show();

  expect(screen.getByText(/Kunde inte hämta/)).toBeTruthy();
  expect(screen.getByText("erik")).toBeTruthy();

  fireEvent.press(screen.getByText("Försök igen"));
  expect(mockRefetchFriends).toHaveBeenCalledTimes(1);
});

it("shows the sent requests with a way to take them back", async () => {
  mockGetOutgoing.mockResolvedValue([outgoingRequest("dora")]);
  await show();
  await flushUntil(() => screen.queryByText("dora"));

  expect(screen.getByText("Skickade (1)")).toBeTruthy();

  fireEvent.press(actionButton("Ångra skickad förfrågan"));
  expect(mockRemoveFriend).toHaveBeenCalledWith("id-dora");
});
