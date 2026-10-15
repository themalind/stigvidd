// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ShareHikeModal from "@/components/shared-hike/share-hike-modal";
import { MAX_SHARE_RECIPIENTS } from "@/constants/constants";
import { FriendResponse } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";

const mockGetFriends = jest.fn();

jest.mock("@/api/friends", () => ({
  getFriends: () => mockGetFriends(),
}));

// A plain atom carries the nickname, which is what the friend list filters the sharer out by.
jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom({ data: { nickName: "jag" } }) };
});

const onShare = jest.fn();
const onDismiss = jest.fn();

function friend(nickName: string): FriendResponse {
  return { identifier: `id-${nickName}`, nickName } as FriendResponse;
}

function show(props: Partial<React.ComponentProps<typeof ShareHikeModal>> = {}) {
  return renderWithProviders(<ShareHikeModal visible onDismiss={onDismiss} onShare={onShare} {...props} />);
}

// Validation resolves on a microtask, so flushing act settles the step.
async function goToFriends() {
  fireEvent.press(screen.getByText("Nästa"));
  await act(async () => {});
  expect(screen.queryByText("Nästa")).toBeNull();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetFriends.mockResolvedValue([friend("bertil"), friend("cissi")]);
});

it("opens on the form, not on the friend list", () => {
  show();

  expect(screen.getByText("Dela med en vän")).toBeTruthy();
  expect(screen.getByText("Nästa")).toBeTruthy();
  expect(screen.queryByText("bertil")).toBeNull();
});

it("goes on to the friends and back again", async () => {
  show();

  await goToFriends();
  expect(await screen.findByText("bertil")).toBeTruthy();

  fireEvent.press(screen.getByText("Tillbaka"));
  expect(screen.getByText("Nästa")).toBeTruthy();
});

// The limits mirror the backend validator, so an over-long share never reaches the friend list.
it("keeps an over-long field on the form", async () => {
  show();

  fireEvent.changeText(screen.getByTestId("share-gettingThere"), "x".repeat(201));
  fireEvent.press(screen.getByText("Nästa"));

  expect(await screen.findByText("Max 200 tecken")).toBeTruthy();
  expect(screen.getByText("Nästa")).toBeTruthy();
});

it("allows a description up to its own, larger limit", async () => {
  show();

  fireEvent.changeText(screen.getByTestId("share-description"), "x".repeat(500));
  await goToFriends();

  expect(screen.queryByText("Max 500 tecken")).toBeNull();
});

it("shares with the friend that was ticked, carrying what the form said", async () => {
  show();

  fireEvent.changeText(screen.getByTestId("share-parkingInfo"), "Grusplan vid vändplatsen");
  fireEvent.press(screen.getByText("Tillåt att mottagaren delar vidare till sina vänner"));
  await goToFriends();

  fireEvent.press(await screen.findByText("cissi"));
  fireEvent.press(screen.getByText("Dela med 1 vän"));

  expect(onShare).toHaveBeenCalledWith(
    ["cissi"],
    expect.objectContaining({ parkingInfo: "Grusplan vid vändplatsen", allowResharing: true }),
  );
});

it("shares with every friend ticked, and not one ticked off again", async () => {
  mockGetFriends.mockResolvedValue([friend("bertil"), friend("cissi"), friend("dora")]);
  show();

  await goToFriends();
  fireEvent.press(await screen.findByText("bertil"));
  fireEvent.press(screen.getByText("cissi"));
  fireEvent.press(screen.getByText("dora"));
  fireEvent.press(screen.getByText("cissi"));
  fireEvent.press(screen.getByText("Dela med 2 vänner"));

  expect(onShare).toHaveBeenCalledTimes(1);
  expect(onShare).toHaveBeenCalledWith(["bertil", "dora"], expect.anything());
});

it("stops ticking at the recipient limit and says why", async () => {
  const names = Array.from({ length: MAX_SHARE_RECIPIENTS + 1 }, (_, i) => `vän${i}`);
  mockGetFriends.mockResolvedValue(names.map(friend));
  show();

  await goToFriends();
  await screen.findByText(names[0]);
  expect(screen.queryByText(/högst/)).toBeNull();
  names.forEach((n) => fireEvent.press(screen.getByText(n)));
  fireEvent.press(screen.getByText(`Dela med ${MAX_SHARE_RECIPIENTS} vänner`));

  expect(screen.getByText(`Du kan dela med högst ${MAX_SHARE_RECIPIENTS} vänner åt gången.`)).toBeTruthy();
  expect(onShare).toHaveBeenCalledWith(names.slice(0, MAX_SHARE_RECIPIENTS), expect.anything());
});

it("shares with no one until someone is ticked", async () => {
  show();

  await goToFriends();
  await screen.findByText("bertil");
  fireEvent.press(screen.getByText("Välj vänner"));

  expect(onShare).not.toHaveBeenCalled();
});

// Sharing is a write. A second tap while the first is in flight would send it twice.
it("takes no ticks or second share while a share is in flight", async () => {
  show({ isPending: true });

  await goToFriends();
  fireEvent.press(await screen.findByText("bertil"));

  expect(screen.queryByText("Dela med 1 vän")).toBeNull();
  expect(onShare).not.toHaveBeenCalled();
});

// You cannot share with yourself.
it("leaves out the sharer", async () => {
  mockGetFriends.mockResolvedValue([friend("jag"), friend("bertil")]);
  show();

  await goToFriends();

  expect(await screen.findByText("bertil")).toBeTruthy();
  expect(screen.queryByText("jag")).toBeNull();
});

it("says so when there is no one to share with", async () => {
  mockGetFriends.mockResolvedValue([]);
  show();

  await goToFriends();

  expect(await screen.findByText("Du har inga vänner att dela med.")).toBeTruthy();
});

// Reopening the modal starts at the form, not the friend list of the walk just closed.
it("returns to the form when it is closed", async () => {
  const { rerender } = show();

  await goToFriends();
  fireEvent.press(screen.getByLabelText("Stäng"));
  await waitFor(() => expect(onDismiss).toHaveBeenCalled());

  rerender(<ShareHikeModal visible onDismiss={onDismiss} onShare={onShare} />);
  expect(screen.getByText("Nästa")).toBeTruthy();
});
