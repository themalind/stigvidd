// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AdventureCard from "@/components/home/adventure-card";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { TrailShortInfoResponse } from "@/data/types";
import { UserLocation } from "@/hooks/useUserLocation";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Image } from "expo-image";

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

// The reveal has its own suite, and its card fetch is not this component's business.
jest.mock("@/hooks/useTrailCard", () => ({
  useTrailCard: () => ({ card: null, isLoading: false }),
}));

// The filter sheet has its own suite; this stub records its props and exposes its callbacks.
type ModalProps = {
  visible: boolean;
  title?: string;
  showSort?: boolean;
  cities: string[];
  classifications: number[];
  hasLocation: boolean;
  onClose: () => void;
  onUpdateFilter: (key: string, value: unknown) => void;
  onUpdateLengthFilter: (min: number, max: number) => void;
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
    averageRating: 0,
    ...overrides,
  };
}

const TRAILS = [
  trail(),
  trail({ identifier: "t-2", name: "Kypesjön runt", trailLength: 5.2, city: "Borås" }),
  trail({ identifier: "t-3", name: "Rya åsar", trailLength: 12.5, city: "Sandared", classification: 2 }),
];

type AppTheme = typeof AppDefaultTheme | typeof AppDarkTheme;

let clock = 4_000_000;

function show(theme: AppTheme = AppDefaultTheme) {
  return renderWithProviders(<AdventureCard />, { theme });
}

// The trail list has to land before the button does anything, and the pitch renders before
// the query resolves, so the sheet's city list is the signal.
async function showLoaded(theme: AppTheme = AppDefaultTheme) {
  show(theme);
  await flushUntil(() => (mockModal.props?.cities.length ?? 0) > 0);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockModal.props = null;
  mockLocation = null;
  mockGetAllTrails.mockResolvedValue(TRAILS);
  // guardedNavigate debounces on module state for 500 ms across the whole file.
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
  // Pins the draw; pick-random-trail.test.ts covers the draw itself.
  jest.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("AdventureCard", () => {
  it("pitches the draw before anything is drawn", async () => {
    await showLoaded();

    expect(screen.getByText("Känner du dig äventyrlig?")).toBeTruthy();
    expect(screen.getByText("Låt Stigvidd välja en promenad åt dig.")).toBeTruthy();
    expect(screen.getByText("Jag känner mig äventyrlig")).toBeTruthy();
    expect(screen.getByTestId("adventure-filter-summary")).toHaveTextContent("Alla leder");
    expect(screen.queryByTestId("adventure-reveal")).toBeNull();
  });

  it("carries the pitch on a photo, and gives the drawn trail the space instead", async () => {
    await showLoaded();

    expect(screen.getByTestId("adventure-hero")).toBeTruthy();
    // The bundled cover, not a remote one, so the pitch renders offline.
    expect(screen.UNSAFE_getAllByType(Image)[0].props.source).not.toEqual({ uri: expect.anything() });

    fireEvent.press(screen.getByTestId("adventure-roll"));
    await settle();

    expect(screen.queryByTestId("adventure-hero")).toBeNull();
  });

  it("clears the filters from the card, without opening the sheet", async () => {
    await showLoaded();
    expect(screen.queryByTestId("adventure-clear-filters")).toBeNull();

    await act(async () => mockModal.props!.onUpdateFilter("city", "Sandared"));
    expect(screen.getByTestId("adventure-filter-summary")).toHaveTextContent("1 filter");

    fireEvent.press(screen.getByTestId("adventure-clear-filters"));
    await settle();

    expect(screen.getByTestId("adventure-filter-summary")).toHaveTextContent("Alla leder");
    expect(screen.queryByTestId("adventure-clear-filters")).toBeNull();
    // The sheet was never opened, so this is the card's own control.
    expect(screen.queryByTestId("filter-modal")).toBeNull();
  });

  it("keeps the filters reachable beside a drawn trail", async () => {
    await showLoaded();
    await act(async () => mockModal.props!.onUpdateFilter("city", "Sandared"));

    fireEvent.press(screen.getByTestId("adventure-roll"));
    await settle();

    expect(screen.getByText("Rya åsar")).toBeTruthy();
    expect(screen.getByTestId("adventure-filter-button")).toBeTruthy();
    expect(screen.getByTestId("adventure-clear-filters")).toBeTruthy();
  });

  it("cannot be pressed before the trail list lands", async () => {
    let resolve: (value: TrailShortInfoResponse[]) => void = () => {};
    mockGetAllTrails.mockReturnValue(
      new Promise<TrailShortInfoResponse[]>((r) => {
        resolve = r;
      }),
    );
    show();
    await settle();

    expect(screen.getByTestId("adventure-roll")).toBeDisabled();

    // Landed before the test returns — a promise still in flight keeps the worker alive.
    await act(async () => resolve(TRAILS));
  });

  it("draws a trail and swaps the pitch for the result", async () => {
    await showLoaded();

    fireEvent.press(screen.getByTestId("adventure-roll"));
    await settle();

    expect(screen.getByText("Din promenad blev…")).toBeTruthy();
    expect(screen.getByText("Kvarnstigen")).toBeTruthy();
    expect(screen.queryByText("Känner du dig äventyrlig?")).toBeNull();
    expect(screen.queryByTestId("adventure-roll")).toBeNull();
  });

  it("never re-draws the trail already showing", async () => {
    await showLoaded();

    fireEvent.press(screen.getByTestId("adventure-roll"));
    await settle();
    expect(screen.getByText("Kvarnstigen")).toBeTruthy();

    // Math.random is pinned to 0, so without the exclusion this lands on Kvarnstigen again.
    fireEvent.press(screen.getByTestId("adventure-reroll"));
    await settle();

    expect(screen.getByText("Kypesjön runt")).toBeTruthy();
    expect(screen.queryByText("Kvarnstigen")).toBeNull();
  });

  it("opens the drawn trail on the home stack", async () => {
    await showLoaded();
    fireEvent.press(screen.getByTestId("adventure-roll"));
    await settle();

    fireEvent.press(screen.getByTestId("adventure-open"));

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: "/(tabs)/(home)/trail/[identifier]",
      params: { identifier: "t-1" },
    });
  });

  it("hands the filter sheet the trail list's cities and difficulties, without sorting", async () => {
    await showLoaded();

    fireEvent.press(screen.getByTestId("adventure-filter-button"));
    await settle();

    expect(screen.getByTestId("filter-modal")).toBeTruthy();
    expect(mockModal.props?.cities).toEqual(["Borås", "Sandared"]);
    expect(mockModal.props?.classifications).toEqual([1, 2]);
    // A draw of one has no order, so the sheet hides sort and titles itself "Filter".
    expect(mockModal.props?.showSort).toBe(false);
    expect(mockModal.props?.title).toBe("Filter");
    expect(mockModal.props?.hasLocation).toBe(false);
  });

  it("offers the near-me filter only with a real position", async () => {
    mockLocation = { latitude: 57.65, longitude: 13.02 } as UserLocation;
    await showLoaded();

    fireEvent.press(screen.getByTestId("adventure-filter-button"));
    await settle();

    expect(mockModal.props?.hasLocation).toBe(true);
  });

  it("counts the active filters, treating a length range as one", async () => {
    await showLoaded();

    await act(async () => mockModal.props!.onUpdateFilter("city", "Borås"));
    expect(screen.getByTestId("adventure-filter-summary")).toHaveTextContent("1 filter");

    await act(async () => mockModal.props!.onUpdateLengthFilter(4, 11));
    expect(screen.getByTestId("adventure-filter-summary")).toHaveTextContent("2 filter");
  });

  it("draws only from the filtered trails", async () => {
    await showLoaded();

    await act(async () => mockModal.props!.onUpdateFilter("city", "Sandared"));
    fireEvent.press(screen.getByTestId("adventure-roll"));
    await settle();

    expect(screen.getByText("Rya åsar")).toBeTruthy();
  });

  it("says so when the filters match nothing, and clears them on request", async () => {
    await showLoaded();

    await act(async () => mockModal.props!.onUpdateLengthFilter(100, 150));

    expect(screen.getByTestId("adventure-no-match")).toBeTruthy();
    expect(screen.queryByTestId("adventure-roll")).toBeNull();

    fireEvent.press(screen.getByTestId("adventure-clear-filters"));
    await settle();

    expect(screen.queryByTestId("adventure-no-match")).toBeNull();
    expect(screen.getByTestId("adventure-roll")).toBeTruthy();
    expect(screen.getByTestId("adventure-filter-summary")).toHaveTextContent("Alla leder");
  });

  it("drops a drawn trail the filters no longer allow", async () => {
    await showLoaded();
    fireEvent.press(screen.getByTestId("adventure-roll"));
    await settle();
    expect(screen.getByText("Kvarnstigen")).toBeTruthy();

    // Kvarnstigen is in Borås, so this filter excludes what is on screen.
    await act(async () => mockModal.props!.onUpdateFilter("city", "Sandared"));

    expect(screen.queryByText("Kvarnstigen")).toBeNull();
    expect(screen.getByTestId("adventure-roll")).toBeTruthy();
    expect(screen.getByText("Känner du dig äventyrlig?")).toBeTruthy();
  });

  it("draws its surfaces from the theme in both modes", async () => {
    await showLoaded();
    expect(screen.getByTestId("adventure-roll")).toHaveStyle({
      backgroundColor: AppDefaultTheme.colors.primary,
    });

    screen.unmount();
    await showLoaded(AppDarkTheme);
    expect(screen.getByTestId("adventure-roll")).toHaveStyle({
      backgroundColor: AppDarkTheme.colors.primary,
    });
  });
});
