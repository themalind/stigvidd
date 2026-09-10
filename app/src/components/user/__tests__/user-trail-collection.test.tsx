// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import UserTrailCollection from "@/components/user/user-trail-collection";
import { UserFavoritesTrail } from "@/data/types";
import { stubMeasureInWindow } from "@/test/measure";
import { renderWithProviders } from "@/test/render";
import { Slider as RangeSlider } from "@miblanchard/react-native-slider";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Platform } from "react-native";

const mockNavigate = jest.fn();
const mockUserLocation = jest.fn();

jest.mock("expo-router", () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args), back: jest.fn() },
}));

jest.mock("@/hooks/useUserLocation", () => ({
  useRealUserLocation: () => mockUserLocation(),
}));

const onDelete = jest.fn();

let measured: ReturnType<typeof stubMeasureInWindow>;

// The sort menu measures an anchor and the filter sheet's selects only list options on Android;
// both have their own suites.
beforeAll(() => {
  measured = stubMeasureInWindow();
  Platform.OS = "android";
});

afterAll(() => {
  measured.restore();
  Platform.OS = "ios";
});

function trail(overrides: Partial<UserFavoritesTrail> = {}): UserFavoritesTrail {
  return {
    identifier: "trail-1",
    name: "Kvarnstigen",
    trailLength: 4.2,
    city: "Borås",
    classification: 2,
    accessibility: false,
    startLatitude: 57.72,
    startLongitude: 12.94,
    ...overrides,
  };
}

const TRAILS = [
  trail(),
  trail({ identifier: "trail-2", name: "Sjöleden", city: "Göteborg", trailLength: 9.5, classification: 1 }),
];

function show(props: Partial<React.ComponentProps<typeof UserTrailCollection>> = {}) {
  return renderWithProviders(
    <UserTrailCollection
      title="Mina favoriter"
      noTrailsSavedInfo="Inga favoriter sparade än."
      trails={TRAILS}
      onDelete={onDelete}
      {...props}
    />,
  );
}

function search(query: string) {
  fireEvent.press(screen.getByTestId("icon-search"));
  fireEvent.changeText(screen.getByPlaceholderText("Sök efter led eller ort..."), query);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUserLocation.mockReturnValue(null);
  // guardedNavigate debounces on module state for 500 ms.
  let clock = 4_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("lists what is saved, with its city, length and difficulty", () => {
  show();

  expect(screen.getByText("Kvarnstigen")).toBeTruthy();
  expect(screen.getByText("Borås")).toBeTruthy();
  expect(screen.getByText("4.2 km")).toBeTruthy();
  expect(screen.getByText("Medel")).toBeTruthy();
});

it("opens the trail that was tapped", () => {
  show();

  fireEvent.press(screen.getByText("Sjöleden"));

  expect(mockNavigate).toHaveBeenCalledWith({
    pathname: "/(tabs)/(profile-stack)/trail/[identifier]",
    params: { identifier: "trail-2" },
  });
});

// The cross sits inside the card's Pressable, and removing a trail must not also open it.
it("removes a trail without opening it", () => {
  show();

  fireEvent.press(screen.getAllByTestId("icon-cross")[0]);

  expect(onDelete).toHaveBeenCalledWith("trail-1");
  expect(mockNavigate).not.toHaveBeenCalled();
});

// Two empty states: nothing saved yet, and a filter that hid everything.
it("tells an empty collection apart from a filter that matched nothing", () => {
  const { unmount } = show({ trails: [] });
  expect(screen.getByText("Inga favoriter sparade än.")).toBeTruthy();
  expect(screen.queryByText("Inga leder hittades")).toBeNull();
  unmount();

  show();
  search("finns inte");

  expect(screen.getByText("Inga leder hittades")).toBeTruthy();
  expect(screen.getByText("Prova att ändra dina filter")).toBeTruthy();
  expect(screen.queryByText("Inga favoriter sparade än.")).toBeNull();
});

it("searches by name and by city", () => {
  const { unmount } = show();
  search("sjö");
  expect(screen.getByText("Sjöleden")).toBeTruthy();
  expect(screen.queryByText("Kvarnstigen")).toBeNull();
  unmount();

  show();
  search("borås");
  expect(screen.getByText("Kvarnstigen")).toBeTruthy();
  expect(screen.queryByText("Sjöleden")).toBeNull();
});

// The hint and the result counter share one line, and the counter wins while filtering.
it("gives the tap hint's slot to the result counter while filtering", () => {
  show();
  expect(screen.getByText(/Tryck på en promenad/)).toBeTruthy();

  search("sjö");

  expect(screen.queryByText(/Tryck på en promenad/)).toBeNull();
  expect(screen.getByText("Visar 1 av 2 leder")).toBeTruthy();
});

// Without a fix there is no distance, so neither the per-card line nor the sort field appears.
it("keeps distance out of it until the position is real", () => {
  const { unmount } = show();
  expect(screen.queryByText(/bort/)).toBeNull();
  fireEvent.press(screen.getByTestId("icon-filter-list"));
  expect(screen.queryByText("Avstånd")).toBeNull();
  unmount();

  mockUserLocation.mockReturnValue({ latitude: 57.72, longitude: 12.94 });
  show();
  expect(screen.getAllByText(/bort/).length).toBeGreaterThan(0);
  fireEvent.press(screen.getByTestId("icon-filter-list"));
  expect(screen.getByText("Avstånd")).toBeTruthy();
});

// The badge counts choices, not keys: minLength and maxLength are one choice to the user.
it("counts a length range as a single filter", () => {
  show();
  expect(screen.queryByText("1")).toBeNull();

  fireEvent.press(screen.getByTestId("icon-filter-list"));
  fireEvent.press(screen.getByText("Fler filter…"));
  fireEvent.press(screen.getByText("Alla orter"));
  // The city also appears on the trail card behind the sheet; the row is the later one.
  fireEvent.press(screen.getAllByText("Borås").at(-1)!);

  const lengthSlider = screen
    .UNSAFE_getAllByType(RangeSlider as never)
    .find((node) => node.props.maximumValue === 150)!;
  act(() => lengthSlider.props.onSlidingComplete([2, 6]));

  fireEvent.press(screen.getByText("Klar"));

  expect(screen.getByText("2")).toBeTruthy();
  expect(screen.getByText("Visar 1 av 2 leder")).toBeTruthy();
});

it("shows no difficulty for a trail that has not been classified", () => {
  show({ trails: [trail({ classification: 0 })] });

  expect(screen.getByText("Kvarnstigen")).toBeTruthy();
  expect(screen.queryByText("Inte klassificerad")).toBeNull();
});

// The API answers with an empty array rather than omitting the field.
it("draws no image for a trail whose image list is empty", () => {
  show({ trails: [trail({ trailImages: [] })] });

  expect(screen.getByText("Kvarnstigen")).toBeTruthy();
});
