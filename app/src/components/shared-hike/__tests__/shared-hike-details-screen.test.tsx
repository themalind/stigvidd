// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { snackbarAtom } from "@/atoms/snackbar-atoms";
import SharedHikeDetailsScreen from "@/components/shared-hike/shared-hike-details-screen";
import { SharedHike } from "@/data/types";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const mockGetSharedHikes = jest.fn();
const mockRemove = jest.fn();
const mockReshare = jest.fn();
const mockNavigate = jest.fn();
const mockBack = jest.fn();
const mockGetFriends = jest.fn();
let mockIdentifier = "hike-1";
let mockIsAuthenticated = true;
let clock = 3_000_000;

jest.mock("@/api/shared-hikes", () => ({
  getSharedHikes: () => mockGetSharedHikes(),
  removeSharedHike: (...args: unknown[]) => mockRemove(...args),
  reshareHike: (...args: unknown[]) => mockReshare(...args),
}));

jest.mock("@/api/hikes", () => ({
  hikeRouteQueryKey: (identifier: string) => ["hike-route", identifier],
}));

jest.mock("@/api/friends", () => ({ getFriends: () => mockGetFriends() }));

const mockTrack = jest.fn();
jest.mock("@/services/analytics", () => ({ track: (...args: unknown[]) => mockTrack(...args) }));

const mockCreateReport = jest.fn();
jest.mock("@/api/content-reports", () => ({
  getReportReasons: () => Promise.resolve(["Offensive", "Spam"]),
  createContentReport: (...args: unknown[]) => mockCreateReport(...args),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: mockNavigate, back: mockBack }),
  useLocalSearchParams: () => ({ identifier: mockIdentifier }),
  router: { navigate: (...args: unknown[]) => mockNavigate(...args), back: mockBack },
}));

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated, logout: jest.fn() }),
}));

jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom({ data: { identifier: "me", nickName: "jag" } }) };
});

let mockWriteBlocked: "banned" | null = null;
jest.mock("@/hooks/useCanWrite", () => ({
  useCanWrite: () => ({ canWrite: mockWriteBlocked === null, reason: mockWriteBlocked }),
}));

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
    images: [],
    ...overrides,
  };
}

async function show(overrides: Partial<SharedHike> = {}) {
  mockGetSharedHikes.mockResolvedValue([
    sharedHike({ hikeIdentifier: "other", hikeName: "Annan runda" }),
    sharedHike(overrides),
  ]);
  const rendered = renderWithProviders(<SharedHikeDetailsScreen />);
  await flushUntil(() => screen.queryByTestId("shared-hike-delete") ?? screen.queryByText("Hittades inte"));
  return rendered;
}

async function reshareWith(...nickNames: string[]) {
  fireEvent.press(screen.getByTestId("shared-hike-share"));
  // keep-comment: opening the modal enables its friends query, so the list lands a tick or two after the press
  await flushUntil(() => screen.queryByText(nickNames[nickNames.length - 1]));
  for (const nickName of nickNames) fireEvent.press(screen.getByText(nickName));
  fireEvent.press(screen.getByText(nickNames.length === 1 ? "Dela med 1 vän" : `Dela med ${nickNames.length} vänner`));
  await settle();
}

function confirmDelete() {
  fireEvent.press(screen.getByTestId("shared-hike-delete"));
  fireEvent.press(screen.getByText("Ta bort"));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIdentifier = "hike-1";
  mockIsAuthenticated = true;
  mockWriteBlocked = null;
  mockRemove.mockResolvedValue(undefined);
  mockReshare.mockResolvedValue(undefined);
  mockGetFriends.mockResolvedValue([{ identifier: "f1", nickName: "cissi" }]);
  // keep-comment: guardedNavigate debounces on module state, so the clock only ever moves on, across tests too
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("shows who shared the walk, when, and its figures", async () => {
  await show();

  expect(screen.getByText("Kvällspromenad")).toBeTruthy();
  expect(screen.queryByText("Annan runda")).toBeNull();
  expect(screen.getByText("Delad av")).toBeTruthy();
  expect(screen.getByText("bertil")).toBeTruthy();
  expect(screen.getByText(/2026-05-04/)).toBeTruthy();
  expect(screen.getByText("4.2 km")).toBeTruthy();
  expect(screen.getByText("01:30:00")).toBeTruthy();
});

it("says the walk is gone when it is no longer shared", async () => {
  mockIdentifier = "unshared";
  await show();

  expect(screen.getByText("Hittades inte")).toBeTruthy();
});

it("asks for a sign-in instead of crashing once signed out", async () => {
  mockIsAuthenticated = false;
  await show();

  expect(screen.getByText("Inte inloggad")).toBeTruthy();
  expect(mockGetSharedHikes).not.toHaveBeenCalled();
});

it("opens the follow screen in the profile stack with the route already seeded", async () => {
  const { queryClient } = await show();

  fireEvent.press(screen.getByLabelText("Visa kartvy"));

  expect(queryClient.getQueryData(["hike-route", "hike-1"])).toBe(sharedHike().coordinates);
  expect(mockNavigate).toHaveBeenCalledWith({
    pathname: "/(tabs)/(profile-stack)/hike-follow/[identifier]",
    params: { identifier: "hike-1", name: "Kvällspromenad" },
  });
});

it("explains the ban instead of opening the reshare list", async () => {
  mockWriteBlocked = "banned";
  await show();

  fireEvent.press(screen.getByTestId("shared-hike-share"));

  expect(screen.getByText("Du har blivit avstängd")).toBeTruthy();
  expect(screen.queryByText("Dela med en vän")).toBeNull();
  expect(mockGetFriends).not.toHaveBeenCalled();
});

it("removes the walk only once confirmed, then leaves the screen", async () => {
  const { store } = await show();

  fireEvent.press(screen.getByTestId("shared-hike-delete"));
  expect(mockRemove).not.toHaveBeenCalled();
  confirmDelete();
  await settle();

  expect(mockRemove).toHaveBeenCalledWith("hike-1");
  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "success" });
});

it("stays on the walk when removing it fails", async () => {
  mockRemove.mockRejectedValue(new Error("boom"));
  const { store } = await show();

  confirmDelete();
  await settle();

  expect(mockBack).not.toHaveBeenCalled();
  expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "error" });
});

it("hides resharing when the owner disallowed it, and says why", async () => {
  await show({ allowResharing: false });

  expect(screen.queryByTestId("shared-hike-share")).toBeNull();
  expect(screen.getByTestId("shared-hike-delete")).toBeTruthy();
  expect(screen.getByText("Ägaren tillåter inte att promenaden delas vidare.")).toBeTruthy();
});

it("reshares with every friend ticked in one request and stays on the walk", async () => {
  mockGetFriends.mockResolvedValue([
    { identifier: "f1", nickName: "cissi" },
    { identifier: "f2", nickName: "dora" },
  ]);
  const { store } = await show();

  await reshareWith("cissi", "dora");

  expect(mockReshare).toHaveBeenCalledTimes(1);
  expect(mockReshare).toHaveBeenCalledWith({ hikeIdentifier: "hike-1", reShareToNames: ["cissi", "dora"] });
  expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "success" });
  expect(mockBack).not.toHaveBeenCalled();
  expect(mockTrack).toHaveBeenCalledWith("hike.shared", {
    kind: "reshare",
    outcome: "success",
    recipientCount: 2,
    allowResharing: false,
  });
});

it.each([
  [404, "Någon du valde är inte längre din vän. Välj igen.", "recipient_unavailable"],
  [403, "Ägaren har inte tillåtit att den här promenaden delas vidare.", "not_allowed"],
  [400, "Något gick fel försök igen senare.", "error"],
  [500, "Något gick fel försök igen senare.", "error"],
])("explains a %s from the reshare", async (status, message, outcome) => {
  mockReshare.mockRejectedValue(new ApiError("nope", status as number));
  const { store } = await show();

  await reshareWith("cissi");

  expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "error", message });
  expect(mockTrack).toHaveBeenCalledWith("hike.shared", expect.objectContaining({ kind: "reshare", outcome }));
});

it.each([
  [404, 2],
  [500, 1],
])("refetches the friend list only when a picked friend is gone (%s)", async (status, fetches) => {
  mockReshare.mockRejectedValue(new ApiError("nope", status));
  await show();

  await reshareWith("cissi");
  await settle();

  expect(mockGetFriends).toHaveBeenCalledTimes(fetches);
});

it("offers removal as a quiet text button in the error colour, under the reshare button", async () => {
  const { theme } = await show();

  expect(screen.getByText("Dela vidare")).toBeTruthy();
  expect(screen.getByText("Ta bort promenaden")).toHaveStyle({ color: theme.colors.error });
  expect(screen.getByTestId("shared-hike-delete-container")).not.toHaveStyle({ borderWidth: 1 });
});

describe("images", () => {
  const photo = (n: number) => ({ identifier: `img-${n}`, imageUrl: `https://media.stigvidd.se/hikes/${n}.jpg` });

  it("shows nothing where the owner's images would be when there are none", async () => {
    await show();

    expect(screen.queryByTestId("hike-images-empty")).toBeNull();
    expect(screen.queryByTestId("hike-images")).toBeNull();
  });

  it("shows the owner's images without any way to add to them", async () => {
    await show({ images: [photo(1), photo(2)] });

    expect(screen.getAllByTestId("hike-image-thumb")).toHaveLength(2);
    expect(screen.queryByTestId("hike-images-add")).toBeNull();
  });

  it("opens the viewer on the tapped image, without a bin", async () => {
    await show({ images: [photo(1), photo(2)] });

    fireEvent.press(screen.getAllByTestId("hike-image-thumb")[1]);
    await settle();

    expect(screen.getByTestId("review-image-list").props.initialScrollIndex).toBe(1);
    expect(screen.queryByTestId("image-viewer-delete")).toBeNull();
  });

  it("reports the image on screen as a hike image, then refetches the walk", async () => {
    mockCreateReport.mockResolvedValue({ identifier: "report-1" });
    await show({ images: [photo(1), photo(2)] });

    fireEvent.press(screen.getAllByTestId("hike-image-thumb")[1]);
    await settle();
    fireEvent.press(screen.getByTestId("image-viewer-report"));
    await flushUntil(() => screen.queryByTestId("report-submit"));
    const fetchesBefore = mockGetSharedHikes.mock.calls.length;
    fireEvent.press(screen.getByTestId("report-submit"));
    await flushUntil(() => (mockGetSharedHikes.mock.calls.length > fetchesBefore ? true : null));
    await flushUntil(() => mockTrack.mock.calls.length > 0);

    expect(mockCreateReport).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "HikeImage", contentIdentifier: "img-2" }),
    );
    expect(screen.queryByTestId("review-image-list")).toBeNull();
    expect(mockTrack).toHaveBeenCalledWith("hike.image_reported", {});
  });

  it("explains the ban instead of opening the report form", async () => {
    mockWriteBlocked = "banned";
    await show({ images: [photo(1)] });

    fireEvent.press(screen.getAllByTestId("hike-image-thumb")[0]);
    await settle();
    fireEvent.press(screen.getByTestId("image-viewer-report"));
    await settle();

    expect(screen.getByText("Du har blivit avstängd")).toBeTruthy();
    expect(screen.queryByTestId("report-submit")).toBeNull();
  });
});
