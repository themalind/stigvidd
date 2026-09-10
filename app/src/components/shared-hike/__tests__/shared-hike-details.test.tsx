// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { snackbarAtom } from "@/atoms/snackbar-atoms";
import SharedHikeDetails from "@/components/shared-hike/shared-hike-details";
import { SharedHike } from "@/data/types";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen } from "@testing-library/react-native";

const mockRemove = jest.fn();
const mockReshare = jest.fn();
const mockNavigate = jest.fn();
const mockGetFriends = jest.fn();

jest.mock("@/api/shared-hikes", () => ({
  removeSharedHike: (...args: unknown[]) => mockRemove(...args),
  reshareHike: (...args: unknown[]) => mockReshare(...args),
}));

jest.mock("@/api/hikes", () => ({
  hikeRouteQueryKey: (identifier: string) => ["hike-route", identifier],
}));

jest.mock("@/api/friends", () => ({ getFriends: () => mockGetFriends() }));

jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: mockNavigate, back: jest.fn() }),
}));

jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom({ data: { identifier: "me", nickName: "jag" } }) };
});

const onDismiss = jest.fn();
const onAccept = jest.fn();
const onReject = jest.fn();

function sharedHike(overrides: Partial<SharedHike> = {}): SharedHike {
  return {
    hikeIdentifier: "hike-1",
    hikeName: "Kvällspromenad",
    hikeLength: 4.2,
    duration: 5_400_000,
    coordinates: JSON.stringify([
      { latitude: 57.72, longitude: 12.94 },
      { latitude: 57.73, longitude: 12.95 },
    ]),
    createdByName: "bertil",
    sharedByName: "bertil",
    sharedByIdentifier: "friend-1",
    sharedAt: "2026-05-04T18:00:00Z",
    allowResharing: true,
    ...overrides,
  };
}

// An accepted share and an invitation are the same modal; the decision handlers tell them apart.
function showAccepted(overrides: Partial<SharedHike> = {}) {
  return renderWithProviders(<SharedHikeDetails visible sharedHike={sharedHike(overrides)} onDismiss={onDismiss} />);
}

function showInvitation(props: Partial<React.ComponentProps<typeof SharedHikeDetails>> = {}) {
  return renderWithProviders(
    <SharedHikeDetails
      visible
      sharedHike={sharedHike()}
      onDismiss={onDismiss}
      onAccept={onAccept}
      onReject={onReject}
      {...props}
    />,
  );
}

// Opening the modal enables its friends query, so the list lands a tick or two after the press.
async function openReshare(nickName: string) {
  fireEvent.press(screen.getByText("Dela"));
  await flushUntil(() => screen.queryByText(nickName));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRemove.mockResolvedValue(undefined);
  mockReshare.mockResolvedValue(undefined);
  mockGetFriends.mockResolvedValue([{ identifier: "f1", nickName: "cissi" }]);
  // guardedNavigate debounces on module state, so each call moves the clock a second on.
  let clock = 3_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("shows who shared the walk, when, and its figures", () => {
  showAccepted();

  expect(screen.getByText("Kvällspromenad")).toBeTruthy();
  expect(screen.getByText("bertil")).toBeTruthy();
  expect(screen.getByText("2026-05-04")).toBeTruthy();
  expect(screen.getByText("4.2 km")).toBeTruthy();
  expect(screen.getByText("01:30:00")).toBeTruthy();
});

it("waits with the spinner until the walk arrives, and says so when it cannot", () => {
  const { rerender } = renderWithProviders(
    <SharedHikeDetails visible sharedHike={null} onDismiss={onDismiss} isLoading />,
  );
  expect(screen.queryByText("Kunde inte hämta promenaden, försök igen.")).toBeNull();

  rerender(<SharedHikeDetails visible sharedHike={null} onDismiss={onDismiss} isError />);
  expect(screen.getByText("Kunde inte hämta promenaden, försök igen.")).toBeTruthy();
});

it("offers a decision on an invitation, and nothing else", () => {
  showInvitation();

  expect(screen.getByText("Acceptera")).toBeTruthy();
  expect(screen.getByText("Avvisa")).toBeTruthy();
  expect(screen.queryByText("Dela")).toBeNull();
  expect(screen.queryByText("Ta bort")).toBeNull();
});

it("takes no second decision while the first is in flight", () => {
  showInvitation({ isPending: true });

  fireEvent.press(screen.getByText("Acceptera"));
  fireEvent.press(screen.getByText("Avvisa"));

  expect(onAccept).not.toHaveBeenCalled();
  expect(onReject).not.toHaveBeenCalled();
});

// Only an accepted route can be walked, so an invitation's preview map opens no follow screen.
it("opens the follow screen from an accepted walk but not from an invitation", async () => {
  const { unmount } = showInvitation();
  expect(screen.queryByLabelText("Visa kartvy")).toBeNull();
  unmount();

  const { queryClient } = showAccepted();
  fireEvent.press(screen.getByLabelText("Visa kartvy"));

  expect(queryClient.getQueryData(["hike-route", "hike-1"])).toBe(sharedHike().coordinates);
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  expect(mockNavigate).toHaveBeenCalledWith(
    expect.objectContaining({ params: { identifier: "hike-1", name: "Kvällspromenad" } }),
  );
});

// Both instances live on the shared-hikes screen at once, so their source and layer ids differ.
it("keeps the map ids of the two instances apart", () => {
  const { unmount } = showAccepted();
  const accepted = screen.queryAllByTestId("maplibre-Layer").map((node) => node.props.id);
  unmount();

  showInvitation();
  const invitation = screen.queryAllByTestId("maplibre-Layer").map((node) => node.props.id);

  expect(accepted.some((id: string) => id?.startsWith("shared-hike"))).toBe(true);
  expect(invitation.some((id: string) => id?.startsWith("incoming-hike-share"))).toBe(true);
  expect(accepted).not.toEqual(invitation);
});

it("removes the walk only once it has been confirmed", async () => {
  showAccepted();

  fireEvent.press(screen.getByText("Ta bort"));
  expect(mockRemove).not.toHaveBeenCalled();

  // The dialog repeats the label of the button that opened it; the confirm is the second.
  fireEvent.press(screen.getAllByText("Ta bort")[1]);
  await settle();

  expect(mockRemove).toHaveBeenCalledWith("hike-1");
});

// The owner decides whether their walk travels further, and the note says so where the button would be.
it("hides resharing when the owner disallowed it, and says why", () => {
  showAccepted({ allowResharing: false });

  expect(screen.queryByText("Dela")).toBeNull();
  expect(screen.getByText("Ägaren tillåter inte att promenaden delas vidare.")).toBeTruthy();
});

it("reshares with the friend that was picked", async () => {
  showAccepted();

  await openReshare("cissi");
  fireEvent.press(screen.getByText("cissi"));
  await settle();

  expect(mockReshare).toHaveBeenCalledWith({ hikeIdentifier: "hike-1", reShareToName: "cissi" });
});

// Four refusals reach the same catch and are mapped apart: the recipient already has it, they
// created it, resharing is forbidden, and everything else.
it.each([
  [409, "Mottagaren har redan promenaden."],
  [400, "Du kan inte dela en promenad med dess skapare."],
  [403, "Ägaren har inte tillåtit att den här promenaden delas vidare."],
  [500, "Något gick fel försök igen senare."],
])("explains a %s from the reshare", async (status, message) => {
  mockReshare.mockRejectedValue(new ApiError("nope", status as number));
  const { store } = showAccepted();

  await openReshare("cissi");
  fireEvent.press(screen.getByText("cissi"));
  await settle();

  expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "error", message });
});

it("reports a successful reshare and closes", async () => {
  const { store } = showAccepted();

  await openReshare("cissi");
  fireEvent.press(screen.getByText("cissi"));
  await settle();

  expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "success" });
  expect(onDismiss).toHaveBeenCalled();
});
