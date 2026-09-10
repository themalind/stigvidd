// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import TrailsScreen from "@/app/(tabs)/(trails-tab)/index";
import { userThemeAtom } from "@/atoms/user-theme-atom";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { TrailShortInfoResponse } from "@/data/types";
import { UserLocation } from "@/hooks/useUserLocation";
import { flushUntil, flushUntilGone } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Image } from "expo-image";
import { ActivityIndicator, FlatList } from "react-native";

const mockGetAllTrails = jest.fn();
const mockNavigate = jest.fn();
let mockLocation: UserLocation | null = null;

jest.mock("@/api/trails", () => ({
  getAllTrails: (...args: unknown[]) => mockGetAllTrails(...args),
}));

jest.mock("expo-router", () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
}));

jest.mock("@/hooks/useUserLocation", () => ({
  useRealUserLocation: () => mockLocation,
}));

// The filter sheet has its own suite; this stub covers the wiring — what the screen hands it,
// and what it does with what comes back.
type ModalProps = {
  visible: boolean;
  cities: string[];
  classifications: number[];
  hasLocation: boolean;
  onClose: () => void;
  onUpdateFilter: (key: string, value: unknown) => void;
  onClearFilters: () => void;
};
const mockModal: { props: ModalProps | null } = { props: null };

jest.mock("@/components/trail/trail-list/trail-filter-modal", () => {
  const { View } = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  return {
    TrailFilterModal: (props: ModalProps) => {
      mockModal.props = props;
      return props.visible ? ReactActual.createElement(View, { testID: "filter-modal" }) : null;
    },
  };
});

function trail(overrides: Partial<TrailShortInfoResponse> = {}): TrailShortInfoResponse {
  return {
    identifier: "t-1",
    name: "Kvarnstigen",
    trailLength: 4.2,
    accessibility: false,
    classification: 1,
    city: "Borås",
    ...overrides,
  };
}

const TRAILS: TrailShortInfoResponse[] = [
  trail({ identifier: "t-1", name: "Kvarnstigen", city: "Borås", trailLength: 4.2, classification: 1 }),
  trail({ identifier: "t-2", name: "Åsundens strandstig", city: "Ulricehamn", trailLength: 9.1, classification: 2 }),
  trail({
    identifier: "t-3",
    name: "Gäsenestigen",
    city: "Borås",
    trailLength: 1.5,
    classification: 0,
    accessibility: true,
  }),
];

async function show(
  trails: TrailShortInfoResponse[] = TRAILS,
  {
    theme = AppDefaultTheme,
    userTheme,
  }: { theme?: typeof AppDefaultTheme | typeof AppDarkTheme; userTheme?: string } = {},
) {
  mockGetAllTrails.mockResolvedValue(trails);
  const rendered = renderWithProviders(<TrailsScreen />, {
    theme,
    initialAtoms: userTheme ? [[userThemeAtom, userTheme]] : [],
  });
  await flushUntil(() => screen.queryByTestId("trails-screen"));
  return rendered;
}

function search(text: string) {
  fireEvent.changeText(screen.getByPlaceholderText("Sök efter led eller ort..."), text);
}

// There is no layout to scroll, so the screen's scroll position arrives through onScroll.
function scrollTo(y: number) {
  fireEvent.scroll(screen.getByTestId("trail-list"), {
    nativeEvent: {
      contentOffset: { y },
      contentSize: { height: 2000, width: 390 },
      layoutMeasurement: { height: 800, width: 390 },
    },
  });
}

// A fetch the test lands itself: the promise for the API mock, and the resolver to call after
// asserting the in-flight state.
function held(): [Promise<TrailShortInfoResponse[]>, (trails: TrailShortInfoResponse[]) => void] {
  let arrive: (trails: TrailShortInfoResponse[]) => void = () => {};
  const pending = new Promise<TrailShortInfoResponse[]>((resolve) => (arrive = resolve));
  return [pending, arrive];
}

function refreshControl() {
  return screen.getByTestId("trail-list").props.refreshControl;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockModal.props = null;
  mockLocation = null;
  // guardedNavigate debounces on module state for 500 ms.
  let clock = 7_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("shows a spinner and nothing else until the trails are in", async () => {
  const [pending, arrive] = held();
  mockGetAllTrails.mockReturnValue(pending);
  renderWithProviders(<TrailsScreen />);

  expect(screen.queryByTestId("trails-screen")).toBeNull();
  expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();

  // A query still in flight when the worker finishes keeps the Jest process alive, so the fetch
  // lands before the test ends.
  await act(async () => arrive(TRAILS));
});

it("offers a retry instead of an empty list when the trails cannot be fetched", async () => {
  mockGetAllTrails.mockRejectedValue(new Error("network"));
  renderWithProviders(<TrailsScreen />);
  await flushUntil(() => screen.queryByText("Försök igen"));

  expect(screen.queryByTestId("trail-list")).toBeNull();

  mockGetAllTrails.mockResolvedValue(TRAILS);
  fireEvent.press(screen.getByText("Försök igen"));
  await flushUntil(() => screen.queryByTestId("trails-screen"));

  expect(screen.getByText("Kvarnstigen")).toBeTruthy();
});

it("lists every trail with its place and length", async () => {
  await show();

  expect(screen.getByText("Kvarnstigen")).toBeTruthy();
  expect(screen.getByText("Åsundens strandstig")).toBeTruthy();
  expect(screen.getByText("Gäsenestigen")).toBeTruthy();
  expect(screen.getByText("Ulricehamn")).toBeTruthy();
  expect(screen.getByText("9.1 km")).toBeTruthy();
});

// The list is sorted by name from the start, whatever order the API answers in.
it("opens sorted by name", async () => {
  await show([
    trail({ identifier: "t-1", name: "Ödsmål" }),
    trail({ identifier: "t-2", name: "Aspen" }),
    trail({ identifier: "t-3", name: "Kvarnstigen" }),
  ]);

  const names = screen.getByTestId("trail-list").props.data.map((item: TrailShortInfoResponse) => item.name);
  expect(names).toEqual(["Aspen", "Kvarnstigen", "Ödsmål"]);
});

it("opens the trail that was pressed", async () => {
  await show();

  fireEvent.press(screen.getByText("Åsundens strandstig"));

  expect(mockNavigate).toHaveBeenCalledWith({
    pathname: "/(tabs)/(trails-tab)/trail/[identifier]",
    params: { identifier: "t-2" },
  });
});

it("narrows the list to the trails whose name matches the search", async () => {
  await show();

  search("kvarn");

  expect(screen.getByText("Kvarnstigen")).toBeTruthy();
  expect(screen.queryByText("Åsundens strandstig")).toBeNull();
});

// Searching for a place is the same box: "Borås" is a search, not a filter.
it("searches the place as well as the name", async () => {
  await show();

  search("ulricehamn");

  expect(screen.getByText("Åsundens strandstig")).toBeTruthy();
  expect(screen.queryByText("Kvarnstigen")).toBeNull();
});

it("says so rather than showing an empty list when nothing matches", async () => {
  await show();

  search("finns inte");

  expect(screen.getByText("Inga leder hittades")).toBeTruthy();
  expect(screen.getByText("Prova att ändra dina filter")).toBeTruthy();
});

it("counts what is shown against what there is", async () => {
  await show();
  expect(screen.getByText("Visar 3 av 3 leder")).toBeTruthy();

  search("kvarn");

  expect(screen.getByText("Visar 1 av 3 leder")).toBeTruthy();
});

// "leder" for three, "led" for one: the counter is pluralised on the total.
it("uses the singular for a single trail", async () => {
  await show([trail()]);

  expect(screen.getByText("Visar 1 av 1 led")).toBeTruthy();
});

it("keeps the clear-filters link out of the way until something is filtered", async () => {
  await show();

  expect(screen.queryByTestId("trails-clear-filters")).toBeNull();

  search("kvarn");

  expect(screen.getByTestId("trails-clear-filters")).toBeTruthy();
});

it("offers to clear once a filter has been set in the sheet", async () => {
  await show();

  act(() => mockModal.props!.onUpdateFilter("city", "Borås"));

  expect(screen.getByTestId("trails-clear-filters")).toBeTruthy();
  expect(screen.queryByText("Åsundens strandstig")).toBeNull();
});

it("clears the search and the filters together", async () => {
  await show();
  search("kvarn");
  act(() => mockModal.props!.onUpdateFilter("city", "Borås"));

  fireEvent.press(screen.getByTestId("trails-clear-filters"));

  expect(screen.getByText("Visar 3 av 3 leder")).toBeTruthy();
  expect(screen.getByText("Åsundens strandstig")).toBeTruthy();
  expect(screen.getByPlaceholderText("Sök efter led eller ort...").props.value).toBe("");
});

it("also clears from inside the sheet", async () => {
  await show();
  search("kvarn");

  act(() => mockModal.props!.onClearFilters());

  expect(screen.getByText("Visar 3 av 3 leder")).toBeTruthy();
});

it("keeps the filter sheet shut until it is asked for", async () => {
  await show();

  expect(screen.queryByTestId("filter-modal")).toBeNull();

  fireEvent.press(screen.getByTestId("trails-filter-button"));

  expect(screen.getByTestId("filter-modal")).toBeTruthy();
});

it("shuts the sheet again when it asks to be closed", async () => {
  await show();
  fireEvent.press(screen.getByTestId("trails-filter-button"));

  act(() => mockModal.props!.onClose());

  expect(screen.queryByTestId("filter-modal")).toBeNull();
});

// The sheet's city and difficulty pickers are built from the list, so a city with no trail is never offered.
it("gives the sheet the places and difficulties the trails actually have", async () => {
  await show();

  expect(mockModal.props!.cities).toEqual(["Borås", "Ulricehamn"]);
  expect(mockModal.props!.classifications).toEqual([1, 2]);
});

it("tells the sheet there is no position to measure from without a real fix", async () => {
  await show();

  expect(mockModal.props!.hasLocation).toBe(false);
});

it("tells the sheet it has a position once there is a real fix", async () => {
  mockLocation = { latitude: 57.72, longitude: 12.94, isFallback: false };
  await show();

  expect(mockModal.props!.hasLocation).toBe(true);
});

it("pulls the trails again on pull-to-refresh", async () => {
  await show();
  expect(mockGetAllTrails).toHaveBeenCalledTimes(1);

  await act(async () => {
    refreshControl().props.onRefresh();
  });

  expect(mockGetAllTrails).toHaveBeenCalledTimes(2);
});

// The spinner has to be the query's, not a second piece of state that can disagree with it.
it("spins the pull-to-refresh control only while a fetch is in flight", async () => {
  await show();
  expect(refreshControl().props.refreshing).toBe(false);

  const [pending, arrive] = held();
  mockGetAllTrails.mockReturnValue(pending);
  await act(async () => {
    refreshControl().props.onRefresh();
  });
  // react-query notifies through a zero-delay timer, so the flag arrives a tick later.
  await flushUntil(() => refreshControl().props.refreshing);
  expect(refreshControl().props.refreshing).toBe(true);

  await act(async () => arrive(TRAILS));
  await flushUntilGone(() => refreshControl().props.refreshing);
  expect(refreshControl().props.refreshing).toBe(false);
});

it("keeps the back-to-top link away until the list has been scrolled well down", async () => {
  await show();

  expect(screen.queryByTestId("trails-back-to-top")).toBeNull();

  act(() => scrollTo(300));
  expect(screen.queryByTestId("trails-back-to-top")).toBeNull();

  act(() => scrollTo(301));
  expect(screen.getByTestId("trails-back-to-top")).toBeTruthy();
});

it("takes the link away again on the way back up", async () => {
  await show();
  act(() => scrollTo(800));
  expect(screen.getByTestId("trails-back-to-top")).toBeTruthy();

  act(() => scrollTo(0));

  expect(screen.queryByTestId("trails-back-to-top")).toBeNull();
});

it("scrolls the list back to the top when the link is pressed", async () => {
  const scrollToOffset = jest.spyOn(FlatList.prototype, "scrollToOffset").mockImplementation(() => {});
  await show();
  act(() => scrollTo(800));

  fireEvent.press(screen.getByTestId("trails-back-to-top"));

  expect(scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: true });
});

it("clears the search from the box's own close button", async () => {
  await show();
  search("kvarn");

  fireEvent.press(screen.getByTestId("search-close-icon"));

  expect(screen.getByPlaceholderText("Sök efter led eller ort...").props.value).toBe("");
  expect(screen.getByText("Åsundens strandstig")).toBeTruthy();
});

// An empty box has nothing to clear, so the button would be a dead target.
it("shows the close button only while there is something typed", async () => {
  await show();

  expect(screen.queryByTestId("search-close-icon")).toBeNull();

  search("kvarn");

  expect(screen.getByTestId("search-close-icon")).toBeTruthy();
});

it("sits on the theme's background, in both themes", async () => {
  await show();
  expect(screen.getByTestId("trails-screen")).toHaveStyle({
    flex: 1,
    backgroundColor: AppDefaultTheme.colors.background,
  });

  screen.unmount();

  await show(TRAILS, { theme: AppDarkTheme });
  expect(screen.getByTestId("trails-screen")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.background });
});

// The filter button is a solid accent block, so its label and icon take the on-colour.
it("draws the filter button on the accent colour with a readable label", async () => {
  await show();

  expect(screen.getByText("Filtrera")).toHaveStyle({ color: AppDefaultTheme.colors.onSecondary });
  expect(screen.getByTestId("icon-filter-list").props.color).toBe(AppDefaultTheme.colors.onSecondary);
});

it("marks the clear-filters link with the tertiary accent", async () => {
  await show();
  search("kvarn");

  expect(screen.getByText("Rensa filter")).toHaveStyle({ color: AppDefaultTheme.colors.tertiary });
});

// The hiker is a dark drawing on light and a light one on dark, so the asset itself changes.
it("swaps the hiker drawing for the user's chosen theme", async () => {
  await show(TRAILS, { userTheme: "light" });
  const light = screen.UNSAFE_getAllByType(Image)[0].props.source;

  screen.unmount();

  await show(TRAILS, { userTheme: "dark" });
  const dark = screen.UNSAFE_getAllByType(Image)[0].props.source;

  expect(dark).not.toEqual(light);
});
