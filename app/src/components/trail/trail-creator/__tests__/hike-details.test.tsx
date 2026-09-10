// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { AppDefaultTheme } from "@/constants/theme";
import { Hike } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import HikeDetails from "@/components/trail/trail-creator/hike-details";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";

const mockDeleteHike = jest.fn();
const mockNavigate = jest.fn();

jest.mock("@/api/hikes", () => ({
  deleteHike: (...args: unknown[]) => mockDeleteHike(...args),
  shareHike: jest.fn(),
  updateHike: jest.fn(),
  hikeRouteQueryKey: (identifier: string) => ["hike-route", identifier],
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: mockNavigate, back: jest.fn() }),
}));

const onDismiss = jest.fn();

function hike(overrides: Partial<Hike> = {}): Hike {
  return {
    identifier: "hike-1",
    name: "Kvällspromenad",
    hikeLength: 4.2,
    duration: 5_400_000,
    createdBy: "user-1",
    createdAt: "2026-05-04T18:00:00Z",
    coordinates: JSON.stringify([
      { latitude: 57.72, longitude: 12.94 },
      { latitude: 57.73, longitude: 12.95 },
    ]),
    ...overrides,
  } as Hike;
}

function show(overrides: Partial<Hike> = {}) {
  return renderWithProviders(
    <HikeDetails
      visible
      hike={hike(overrides)}
      onDismiss={onDismiss}
      hikeFollowRoute="/(tabs)/(profile-stack)/hike-follow/[identifier]"
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteHike.mockResolvedValue(undefined);
  // guardedNavigate debounces on module state, so each call moves the clock a second on.
  let clock = 2_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("shows the walk's name, date and figures", () => {
  show();

  expect(screen.getByText("Kvällspromenad")).toBeTruthy();
  expect(screen.getByText("Skapad: 2026-05-04")).toBeTruthy();
  expect(screen.getByText("4.2 km")).toBeTruthy();
  expect(screen.getByText("01:30:00")).toBeTruthy();
});

// The three info rows are what a shared walk carries; an empty one is a lone icon and a blank label.
it("shows an info row only for the fields the walk actually has", () => {
  show({ parkingInfo: "Grusplan vid vändplatsen" });

  expect(screen.getByText("Parkering")).toBeTruthy();
  expect(screen.getByText("Grusplan vid vändplatsen")).toBeTruthy();
  expect(screen.queryByText("Hitta hit")).toBeNull();
  expect(screen.queryByText("Beskrivning")).toBeNull();
});

it("deletes only after the walk has been confirmed", async () => {
  show();

  fireEvent.press(screen.getByTestId("hike-delete"));
  expect(mockDeleteHike).not.toHaveBeenCalled();

  expect(screen.getByText("Vill du ta bort promenaden?")).toBeTruthy();
  // The dialog repeats the label of the button that opened it; the confirm is the second.
  fireEvent.press(screen.getAllByText("Ta bort")[1]);

  await waitFor(() => expect(mockDeleteHike).toHaveBeenCalledWith("hike-1"));
});

it("keeps the walk when the confirmation is dismissed", () => {
  show();

  fireEvent.press(screen.getByTestId("hike-delete"));
  fireEvent.press(screen.getByText("Avbryt"));

  expect(mockDeleteHike).not.toHaveBeenCalled();
});

// The follow screen reads the route from the query cache, so the modal seeds it before navigating.
it("seeds the route and opens the follow screen from the preview map", async () => {
  const { queryClient } = show();

  fireEvent.press(screen.getByLabelText("Visa kartvy"));

  // Read the seeded route before yielding: at gcTime 0 an entry with no observer is collected next tick.
  expect(queryClient.getQueryData(["hike-route", "hike-1"])).toBe(hike().coordinates);

  // Navigation waits a frame, so the map view is not built while this one unmounts.
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

  expect(mockNavigate).toHaveBeenCalledWith({
    pathname: "/(tabs)/(profile-stack)/hike-follow/[identifier]",
    params: { identifier: "hike-1", name: "Kvällspromenad" },
  });
  expect(onDismiss).toHaveBeenCalled();
});

// Two buttons of equal width on one row, and a title that truncates instead of pushing the close button off.
it("splits the action row evenly and truncates a long name", () => {
  show({ name: "En osedvanligt lång promenadtitel som inte får tränga undan krysset" });

  expect(
    screen.getByText("En osedvanligt lång promenadtitel som inte får tränga undan krysset").props.numberOfLines,
  ).toBe(1);
  for (const id of ["hike-share", "hike-delete"]) {
    expect(screen.getByTestId(`${id}-container-outer-layer`)).toHaveStyle({ flex: 1 });
  }
});

it("draws the stats card on the theme's outline colour", () => {
  show();

  expect(screen.getByTestId("hike-stats")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.outlineVariant,
    borderRadius: BORDER_RADIUS,
  });
});
