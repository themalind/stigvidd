// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { snackbarAtom } from "@/atoms/snackbar-atoms";
import HikeDetailsScreen, { HikeFollowRoute } from "@/components/hike/hike-details-screen";
import { MAX_PENDING_SUBMISSIONS, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { AppDefaultTheme } from "@/constants/theme";
import { Hike } from "@/data/types";
import { flushUntil, settle } from "@/test/flush";
import { formatDate } from "@/utils/format-date";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { View } from "react-native";

const mockGetHikes = jest.fn();
const mockDeleteHike = jest.fn();
const mockUpdateHike = jest.fn();
const mockShareHike = jest.fn();
const mockUploadImage = jest.fn();
const mockDeleteImage = jest.fn();
const mockPickImages = jest.fn();
const mockNavigate = jest.fn();
const mockBack = jest.fn();
let mockIdentifier = "hike-1";
let mockIsAuthenticated = true;
let clock = 2_000_000;

jest.mock("@/api/hikes", () => ({
  getAllHikesByUserId: (...args: unknown[]) => mockGetHikes(...args),
  deleteHike: (...args: unknown[]) => mockDeleteHike(...args),
  shareHike: (...args: unknown[]) => mockShareHike(...args),
  updateHike: (...args: unknown[]) => mockUpdateHike(...args),
  uploadHikeImage: (...args: unknown[]) => mockUploadImage(...args),
  deleteHikeImage: (...args: unknown[]) => mockDeleteImage(...args),
  hikeRouteQueryKey: (identifier: string) => ["hike-route", identifier],
}));

jest.mock("@/utils/pick-images", () => ({ pickImages: (...args: unknown[]) => mockPickImages(...args) }));

const mockGetSubmissions = jest.fn();
const mockCreateSubmission = jest.fn();
jest.mock("@/api/hike-submissions", () => ({
  getMyHikeSubmissions: () => mockGetSubmissions(),
  createHikeSubmission: (...args: unknown[]) => mockCreateSubmission(...args),
}));

const mockGetFriends = jest.fn();
jest.mock("@/api/friends", () => ({ getFriends: () => mockGetFriends() }));

const mockTrack = jest.fn();
jest.mock("@/services/analytics", () => ({ track: (...args: unknown[]) => mockTrack(...args) }));

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
  return { stigviddUserAtom: atom({ data: { identifier: "me" } }) };
});

let mockWriteBlocked: "banned" | null = null;
jest.mock("@/hooks/useCanWrite", () => ({
  useCanWrite: () => ({ canWrite: mockWriteBlocked === null, reason: mockWriteBlocked }),
}));

const PROFILE_FOLLOW: HikeFollowRoute = "/(tabs)/(profile-stack)/hike-follow/[identifier]";

function hike(overrides: Partial<Hike> = {}): Hike {
  return {
    identifier: "hike-1",
    name: "Kvällspromenad",
    hikeLength: 4.2,
    duration: 5_400_000,
    createdBy: "me",
    createdAt: "2026-05-04T18:00:00Z",
    coordinates: JSON.stringify([
      { latitude: 57.72, longitude: 12.94 },
      { latitude: 57.73, longitude: 12.95 },
    ]),
    images: [],
    ...overrides,
  };
}

async function show(overrides: Partial<Hike> = {}, hikeFollowRoute: HikeFollowRoute = PROFILE_FOLLOW) {
  mockGetHikes.mockResolvedValue([hike({ identifier: "other", name: "Annan runda" }), hike(overrides)]);
  const rendered = renderWithProviders(<HikeDetailsScreen hikeFollowRoute={hikeFollowRoute} />);
  await flushUntil(() => screen.queryByTestId("hike-share") ?? screen.queryByText("Hittades inte"));
  return rendered;
}

function confirmDelete() {
  fireEvent.press(screen.getByTestId("hike-delete"));
  // The dialog repeats the label of the button that opened it; the confirm is the second.
  fireEvent.press(screen.getAllByText("Ta bort")[1]);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIdentifier = "hike-1";
  mockIsAuthenticated = true;
  mockWriteBlocked = null;
  mockDeleteHike.mockResolvedValue(undefined);
  mockShareHike.mockResolvedValue(undefined);
  mockDeleteImage.mockResolvedValue({ success: true });
  mockGetFriends.mockResolvedValue([]);
  mockGetSubmissions.mockResolvedValue([]);
  // keep-comment: guardedNavigate debounces on module state, so the clock only ever moves on, across tests too
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("shows the walk from the list that matches the route's identifier", async () => {
  await show();

  expect(mockGetHikes).toHaveBeenCalledWith("me");
  expect(screen.getByText("Kvällspromenad")).toBeTruthy();
  expect(screen.queryByText("Annan runda")).toBeNull();
  expect(screen.getByText("Skapad")).toBeTruthy();
  expect(screen.getByText("2026-05-04")).toBeTruthy();
  expect(screen.getByText("4.2 km")).toBeTruthy();
  expect(screen.getByText("01:30:00")).toBeTruthy();
});

it("says the walk is gone when the list does not have it", async () => {
  mockIdentifier = "deleted-elsewhere";
  await show();

  expect(screen.getByText("Hittades inte")).toBeTruthy();
  expect(screen.queryByTestId("hike-share")).toBeNull();
});

it("asks for a sign-in instead of crashing once signed out", async () => {
  mockIsAuthenticated = false;
  await show();

  expect(screen.getByText("Inte inloggad")).toBeTruthy();
  expect(mockGetHikes).not.toHaveBeenCalled();
});

it("waits with a spinner while the list is on its way", () => {
  mockGetHikes.mockReturnValue(new Promise(() => {}));
  renderWithProviders(<HikeDetailsScreen hikeFollowRoute={PROFILE_FOLLOW} />);

  expect(screen.queryByText("Hittades inte")).toBeNull();
  expect(screen.queryByTestId("hike-share")).toBeNull();
});

it("offers a retry when the list could not be fetched", async () => {
  mockGetHikes.mockRejectedValueOnce(new Error("500"));
  renderWithProviders(<HikeDetailsScreen hikeFollowRoute={PROFILE_FOLLOW} />);
  await flushUntil(() => screen.queryByText("Försök igen"));

  mockGetHikes.mockResolvedValue([hike()]);
  fireEvent.press(screen.getByText("Försök igen"));
  await flushUntil(() => screen.queryByTestId("hike-share"));

  expect(screen.getByText("Kvällspromenad")).toBeTruthy();
});

// The three info rows are what a shared walk carries; an empty one is a lone icon and a blank label.
it("shows an info row only for the fields the walk actually has", async () => {
  await show({ parkingInfo: "Grusplan vid vändplatsen" });

  expect(screen.getByText("Parkering")).toBeTruthy();
  expect(screen.getByText("Grusplan vid vändplatsen")).toBeTruthy();
  expect(screen.queryByText("Hitta hit")).toBeNull();
  expect(screen.queryByText("Beskrivning")).toBeNull();
});

it("shows no info rows at all for a walk without any", async () => {
  await show();

  for (const label of ["Hitta hit", "Parkering", "Beskrivning"]) {
    expect(screen.queryByText(label)).toBeNull();
  }
  expect(screen.getByTestId("hike-delete")).toBeTruthy();
});

it("deletes only after confirming, then leaves the screen", async () => {
  const { store } = await show();

  fireEvent.press(screen.getByTestId("hike-delete"));
  expect(mockDeleteHike).not.toHaveBeenCalled();
  expect(screen.getByText("Vill du ta bort promenaden?")).toBeTruthy();

  fireEvent.press(screen.getAllByText("Ta bort")[1]);
  await settle();

  expect(mockDeleteHike).toHaveBeenCalledWith("hike-1");
  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "success" });
});

it("keeps drawing the deleted walk while the screen pops", async () => {
  await show();

  mockGetHikes.mockResolvedValue([hike({ identifier: "other", name: "Annan runda" })]);
  confirmDelete();
  await flushUntil(() => mockGetHikes.mock.calls.length > 1);
  await settle();

  expect(screen.getByText("Kvällspromenad")).toBeTruthy();
  expect(screen.queryByText("Hittades inte")).toBeNull();
});

it("stays on the walk when the delete fails", async () => {
  mockDeleteHike.mockRejectedValue(new Error("boom"));
  const { store } = await show();

  confirmDelete();
  await settle();

  expect(mockBack).not.toHaveBeenCalled();
  expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "error" });
});

it("keeps the walk when the confirmation is dismissed", async () => {
  await show();

  fireEvent.press(screen.getByTestId("hike-delete"));
  fireEvent.press(screen.getByText("Avbryt"));

  expect(mockDeleteHike).not.toHaveBeenCalled();
});

it("renames the walk on the screen and in the cached list", async () => {
  mockUpdateHike.mockImplementation(async (request) => hike({ name: request.name, parkingInfo: request.parkingInfo }));
  const { queryClient } = await show({ parkingInfo: "Grusplan" });

  fireEvent.press(screen.getByTestId("hike-edit"));
  expect(screen.getByTestId("edit-name").props.value).toBe("Kvällspromenad");
  expect(screen.getByTestId("edit-parkingInfo").props.value).toBe("Grusplan");

  // keep-comment: a refetch that never lands, so the list shows only the patched cache
  mockGetHikes.mockReturnValue(new Promise(() => {}));
  fireEvent.changeText(screen.getByTestId("edit-name"), "Morgonrundan");
  fireEvent.press(screen.getByTestId("edit-hike-save"));
  await flushUntil(() => !screen.queryByTestId("edit-name"));

  expect(mockUpdateHike).toHaveBeenCalledWith({
    hikeIdentifier: "hike-1",
    name: "Morgonrundan",
    gettingThere: null,
    parkingInfo: "Grusplan",
    description: null,
  });
  expect(screen.getByText("Morgonrundan")).toBeTruthy();
  const cached = queryClient.getQueryData<Hike[]>(["hikes", "me"]);
  expect(cached?.map((h) => h.name)).toEqual(["Annan runda", "Morgonrundan"]);
});

it("does not save a name shorter than three characters", async () => {
  await show();

  fireEvent.press(screen.getByTestId("hike-edit"));
  fireEvent.changeText(screen.getByTestId("edit-name"), "Ab");
  fireEvent.press(screen.getByTestId("edit-hike-save"));

  expect(await screen.findByText("Namnet är för kort. Minst 3 tecken")).toBeTruthy();
  expect(mockUpdateHike).not.toHaveBeenCalled();
});

it("keeps the edit form open when the update fails", async () => {
  mockUpdateHike.mockRejectedValue(new Error("boom"));
  await show();

  fireEvent.press(screen.getByTestId("hike-edit"));
  fireEvent.changeText(screen.getByTestId("edit-name"), "Morgonrundan");
  fireEvent.press(screen.getByTestId("edit-hike-save"));
  await settle();

  expect(mockUpdateHike).toHaveBeenCalled();
  expect(screen.getByTestId("edit-name")).toBeTruthy();
  expect(screen.getByText("Kvällspromenad")).toBeTruthy();
});

it("opens the share form for an account that may write", async () => {
  await show();

  fireEvent.press(screen.getByTestId("hike-share"));

  expect(screen.getByText("Dela med en vän")).toBeTruthy();
  expect(screen.queryByText("Du har blivit avstängd")).toBeNull();
});

it.each(["hike-share", "hike-edit"])("explains the ban instead of opening %s", async (testID) => {
  mockWriteBlocked = "banned";
  await show();

  fireEvent.press(screen.getByTestId(testID));

  expect(screen.getByText("Du har blivit avstängd")).toBeTruthy();
  expect(screen.queryByText("Dela med en vän")).toBeNull();
  expect(screen.queryByTestId("edit-name")).toBeNull();
});

it.each<HikeFollowRoute>([
  "/(tabs)/(profile-stack)/hike-follow/[identifier]",
  "/(tabs)/(home)/hike-follow/[identifier]",
])("seeds the route and opens %s from the map", async (route) => {
  const { queryClient } = await show({}, route);

  fireEvent.press(screen.getByLabelText("Visa kartvy"));

  // Read the seeded route before yielding: at gcTime 0 an entry with no observer is collected next tick.
  expect(queryClient.getQueryData(["hike-route", "hike-1"])).toBe(hike().coordinates);
  expect(mockNavigate).toHaveBeenCalledWith({
    pathname: route,
    params: { identifier: "hike-1", name: "Kvällspromenad" },
  });
});

it("splits the action row evenly and truncates a long name", async () => {
  await show({ name: "En osedvanligt lång promenadtitel som inte får tränga undan pennan" });

  expect(
    screen.getByText("En osedvanligt lång promenadtitel som inte får tränga undan pennan").props.numberOfLines,
  ).toBe(1);
  for (const id of ["hike-share", "hike-delete"]) {
    expect(screen.getByTestId(`${id}-container-outer-layer`)).toHaveStyle({ flex: 1 });
  }
});

it("draws the facts and the info as cards on the surface colour", async () => {
  await show({ description: "Blött efter spången" });

  for (const id of ["hike-facts", "hike-info-card"]) {
    expect(screen.getByTestId(id)).toHaveStyle({
      backgroundColor: AppDefaultTheme.colors.surface,
      borderRadius: SURFACE_BORDER_RADIUS,
    });
  }
});

it("leaves the info card out when the walk has nothing to tell", async () => {
  await show();

  expect(screen.queryByTestId("hike-info-card")).toBeNull();
});

it("pins the buttons to the bottom of a short screen", async () => {
  await show();

  expect(screen.getByTestId("hike-bottom")).toHaveStyle({ marginTop: "auto" });
});

it("sets the facts in the same type as the trail's info card", async () => {
  await show();

  expect(screen.getByText("Längd")).toHaveStyle({ fontSize: 11, fontWeight: "600", textTransform: "uppercase" });
  expect(screen.getByText("Längd").props.style).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ fontFamily: expect.anything() })]),
  );
  expect(screen.getByText("4.2 km")).toHaveStyle({ fontSize: 14 });
});

describe("images", () => {
  const photo = (n: number) => ({ identifier: `img-${n}`, imageUrl: `https://media.stigvidd.se/hikes/${n}.jpg` });

  it("invites the owner to add images to a walk that has none", async () => {
    await show();

    expect(screen.getByTestId("hike-images-empty")).toBeTruthy();
  });

  it("picks only as many as still fit, then uploads them", async () => {
    mockPickImages.mockResolvedValue(["file:///a.jpg"]);
    mockUploadImage.mockResolvedValue(photo(9));
    await show({ images: [photo(1), photo(2), photo(3)] });

    fireEvent.press(screen.getByTestId("hike-images-add"));
    await flushUntil(() => mockUploadImage.mock.calls.length > 0);

    expect(mockPickImages).toHaveBeenCalledWith({ limit: 7 });
    expect(mockUploadImage).toHaveBeenCalledWith("hike-1", "file:///a.jpg");
  });

  it("uploads nothing when the picker comes back empty-handed", async () => {
    mockPickImages.mockResolvedValue(null);
    await show();

    fireEvent.press(screen.getByTestId("hike-images-empty"));
    await settle();

    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  it("shows a banned account the dialog instead of the picker", async () => {
    mockWriteBlocked = "banned";
    await show();

    fireEvent.press(screen.getByTestId("hike-images-empty"));
    await settle();

    expect(mockPickImages).not.toHaveBeenCalled();
  });

  it("opens the viewer on the tapped image, and the owner can delete it there", async () => {
    await show({ images: [photo(1), photo(2)] });

    fireEvent.press(screen.getAllByTestId("hike-image-thumb")[1]);
    await settle();
    expect(screen.getByTestId("review-image-list").props.initialScrollIndex).toBe(1);

    fireEvent.press(screen.getByTestId("image-viewer-delete"));
    await settle();
    fireEvent.press(screen.getAllByText("Ta bort").at(-1) ?? screen.getByText("Ta bort"));
    await flushUntil(() => mockDeleteImage.mock.calls.length > 0);

    expect(mockDeleteImage).toHaveBeenCalledWith("hike-1", "img-2");
  });
});

describe("sharing", () => {
  async function shareWith(...nickNames: string[]) {
    mockGetFriends.mockResolvedValue(nickNames.map((nickName) => ({ identifier: `id-${nickName}`, nickName })));
    mockUpdateHike.mockResolvedValue(hike());
    const rendered = await show();

    fireEvent.press(screen.getByTestId("hike-share"));
    fireEvent.press(screen.getByText("Nästa"));
    await settle();
    for (const nickName of nickNames) fireEvent.press(await screen.findByText(nickName));
    fireEvent.press(
      screen.getByText(nickNames.length === 1 ? "Dela med 1 vän" : `Dela med ${nickNames.length} vänner`),
    );
    await flushUntil(() => mockTrack.mock.calls.length > 0);
    return rendered;
  }

  it("shares with every picked friend and counts them, not who they are", async () => {
    const { store } = await shareWith("bertil", "cissi");

    expect(mockShareHike).toHaveBeenCalledWith({
      hikeIdentifier: "hike-1",
      sharedWithNames: ["bertil", "cissi"],
      allowResharing: false,
    });
    expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "success" });
    expect(mockTrack).toHaveBeenCalledWith("hike.shared", {
      kind: "share",
      outcome: "success",
      recipientCount: 2,
      allowResharing: false,
    });
  });

  it("asks to pick again when a picked friend is no longer one", async () => {
    mockShareHike.mockRejectedValue(new ApiError("gone", 404));

    const { store } = await shareWith("bertil");

    expect(store.get(snackbarAtom)).toMatchObject({
      visible: true,
      type: "error",
      message: "Någon du valde är inte längre din vän. Välj igen.",
    });
    expect(mockGetFriends.mock.calls.length).toBeGreaterThan(1);
    expect(mockTrack).toHaveBeenCalledWith(
      "hike.shared",
      expect.objectContaining({ outcome: "recipient_unavailable" }),
    );
  });

  it("reports any other failure as a plain error", async () => {
    mockShareHike.mockRejectedValue(new ApiError("boom", 500));

    const { store } = await shareWith("bertil");

    expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "error" });
    expect(store.get(snackbarAtom).message).not.toBe("Någon du valde är inte längre din vän. Välj igen.");
    expect(mockTrack).toHaveBeenCalledWith("hike.shared", expect.objectContaining({ outcome: "error" }));
  });
});

describe("publishing", () => {
  const expandPublish = async () => {
    fireEvent.press(screen.getByTestId("publish-hike-accordion"));
    await settle();
  };

  it("keeps the publish step folded away until it is opened", async () => {
    await show();
    await settle();

    expect(screen.getByTestId("publish-hike-accordion")).toBeTruthy();
    expect(screen.queryByTestId("hike-publish")).toBeNull();
  });

  it("offers to publish a walk that has not been sent in", async () => {
    await show();
    await settle();
    await expandPublish();

    expect(screen.getByTestId("hike-publish")).toBeTruthy();
    expect(screen.queryByTestId("publish-hike-pending")).toBeNull();
  });

  it("says the walk is waiting instead of offering it again", async () => {
    mockGetSubmissions.mockResolvedValue([
      {
        identifier: "s1",
        name: "x",
        trailLength: 1,
        status: "Pending",
        createdAt: "",
        sourceHikeIdentifier: "hike-1",
        likeCount: 0,
      },
    ]);
    await show();
    await flushUntil(() => screen.queryByTestId("publish-hike-pending"));

    expect(screen.getByTestId("publish-hike-pending")).toBeTruthy();
    expect(screen.queryByTestId("hike-publish")).toBeNull();
  });

  it("shows when the walk was published instead of offering it again", async () => {
    mockGetSubmissions.mockResolvedValue([
      {
        identifier: "s1",
        name: "x",
        trailLength: 1,
        status: "Approved",
        createdAt: "2026-10-01T10:00:00Z",
        decidedAt: "2026-10-05T10:00:00Z",
        sourceHikeIdentifier: "hike-1",
        publishedTrailIdentifier: "trail-9",
        likeCount: 0,
      },
    ]);
    await show();
    await flushUntil(() => screen.queryByTestId("publish-hike-published"));

    expect(screen.getByTestId("publish-hike-published")).toHaveTextContent(
      `Publicerad ${formatDate("2026-10-05T10:00:00Z")}`,
    );
    expect(screen.queryByTestId("publish-hike-accordion")).toBeNull();
  });

  it("says the limit is reached instead of offering it when enough other walks are waiting", async () => {
    mockGetSubmissions.mockResolvedValue(
      Array.from({ length: MAX_PENDING_SUBMISSIONS }, (_, i) => ({
        identifier: `s${i}`,
        name: "x",
        trailLength: 1,
        status: "Pending",
        createdAt: "",
        sourceHikeIdentifier: `other-hike-${i}`,
        likeCount: 0,
      })),
    );
    await show();
    await flushUntil(() => screen.queryByTestId("publish-hike-limit"));

    expect(screen.getByTestId("publish-hike-limit")).toHaveTextContent(
      `Du har redan ${MAX_PENDING_SUBMISSIONS} promenader som väntar på granskning. Du kan publicera fler när de är granskade.`,
    );
    expect(screen.queryByTestId("publish-hike-accordion")).toBeNull();
  });

  it("reads the submissions again on every visit, so a review since the last one shows at once", async () => {
    mockGetSubmissions.mockResolvedValue(
      Array.from({ length: MAX_PENDING_SUBMISSIONS }, (_, i) => ({
        identifier: `s${i}`,
        name: "x",
        trailLength: 1,
        status: "Pending",
        createdAt: "",
        sourceHikeIdentifier: `other-hike-${i}`,
        likeCount: 0,
      })),
    );
    const { rerender } = await show();
    await flushUntil(() => screen.queryByTestId("publish-hike-limit"));

    mockGetSubmissions.mockResolvedValue([]);
    rerender(<View />);
    rerender(<HikeDetailsScreen hikeFollowRoute={PROFILE_FOLLOW} />);
    await flushUntil(() => screen.queryByTestId("publish-hike-accordion"));

    expect(screen.getByTestId("publish-hike-accordion")).toBeTruthy();
    expect(screen.queryByTestId("publish-hike-limit")).toBeNull();
  });

  it("treats a walk as published even when the decision date is missing", async () => {
    mockGetSubmissions.mockResolvedValue([
      {
        identifier: "s1",
        name: "x",
        trailLength: 1,
        status: "Approved",
        createdAt: "2026-10-01T10:00:00Z",
        decidedAt: null,
        sourceHikeIdentifier: "hike-1",
        publishedTrailIdentifier: "trail-9",
        likeCount: 0,
      },
    ]);
    await show();
    await flushUntil(() => screen.queryByTestId("publish-hike-published"));

    expect(screen.getByTestId("publish-hike-published")).toHaveTextContent("Publicerad");
    expect(screen.queryByTestId("publish-hike-accordion")).toBeNull();
  });

  it("offers it again once the published trail has been removed", async () => {
    mockGetSubmissions.mockResolvedValue([
      {
        identifier: "s1",
        name: "x",
        trailLength: 1,
        status: "Approved",
        createdAt: "2026-10-01T10:00:00Z",
        decidedAt: "2026-10-05T10:00:00Z",
        sourceHikeIdentifier: "hike-1",
        publishedTrailIdentifier: null,
        likeCount: 0,
      },
    ]);
    await show();
    await settle();

    expect(screen.getByTestId("publish-hike-accordion")).toBeTruthy();
    expect(screen.queryByTestId("publish-hike-published")).toBeNull();
  });

  it("still offers it when only another walk is pending", async () => {
    mockGetSubmissions.mockResolvedValue([
      {
        identifier: "s1",
        name: "x",
        trailLength: 1,
        status: "Pending",
        createdAt: "",
        sourceHikeIdentifier: "other",
        likeCount: 0,
      },
    ]);
    await show();
    await settle();
    await expandPublish();

    expect(screen.getByTestId("hike-publish")).toBeTruthy();
  });

  it("opens the publish form", async () => {
    await show();
    await settle();
    await expandPublish();

    fireEvent.press(screen.getByTestId("hike-publish"));
    await flushUntil(() => screen.queryByTestId("publish-submit"));

    expect(screen.getByTestId("publish-submit")).toBeTruthy();
  });

  it("keeps a banned user out of the form", async () => {
    mockWriteBlocked = "banned";
    await show();
    await settle();
    await expandPublish();

    fireEvent.press(screen.getByTestId("hike-publish"));
    await settle();

    expect(screen.queryByTestId("publish-submit")).toBeNull();
  });

  const submission = (status: string) => ({
    identifier: "s1",
    name: "x",
    trailLength: 1,
    status,
    createdAt: "",
    sourceHikeIdentifier: "hike-1",
    likeCount: 0,
  });
  const submissionNote = /Ditt inskick för publicering påverkas inte/;

  it.each(["Pending", "Approved"])("says a %s submission outlives the walk before deleting it", async (status) => {
    mockGetSubmissions.mockResolvedValue([submission(status)]);
    await show();
    await settle();

    fireEvent.press(screen.getByTestId("hike-delete"));

    expect(screen.getByText(submissionNote)).toBeTruthy();
  });

  it("says nothing about a submission that was rejected", async () => {
    mockGetSubmissions.mockResolvedValue([submission("Rejected")]);
    await show();
    await settle();

    fireEvent.press(screen.getByTestId("hike-delete"));

    expect(screen.queryByText(submissionNote)).toBeNull();
  });

  it("says a pending submission keeps its copy of a deleted photo", async () => {
    mockGetSubmissions.mockResolvedValue([submission("Pending")]);
    await show({ images: [{ identifier: "img-1", imageUrl: "https://media.stigvidd.se/hikes/1.jpg" }] });
    await settle();

    fireEvent.press(screen.getAllByTestId("hike-image-thumb")[0]);
    await settle();
    fireEvent.press(screen.getByTestId("image-viewer-delete"));
    await settle();

    expect(screen.getByText(/ligger kopian kvar där/)).toBeTruthy();
  });
});
