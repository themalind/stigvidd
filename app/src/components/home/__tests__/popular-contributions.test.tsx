// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { trailListSourceAtom } from "@/atoms/trail-list-atoms";
import PopularContributions, { HOME_CONTRIBUTION_LIMIT } from "@/components/home/popular-contributions";
import { TrailCard } from "@/data/types";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const mockGetPopular = jest.fn();
jest.mock("@/api/trails", () => ({ getPopularContributedTrails: () => mockGetPopular() }));

const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({ router: { navigate: (...args: unknown[]) => mockNavigate(...args) } }));

let clock = 5_000_000;

function card(identifier: string, name: string, likeCount: number, submitterNickName: string | null): TrailCard {
  return {
    identifier,
    name,
    trailLength: 7.2,
    classification: 2,
    isAccessible: false,
    averageRating: 0,
    contribution: { submitterNickName, publishedAt: "2026-09-02T10:00:00Z", likeCount },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // keep-comment: guardedNavigate debounces on module state, so the clock only ever moves on, across tests too
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("renders nothing while there are no published walks", async () => {
  mockGetPopular.mockResolvedValue([]);
  renderWithProviders(<PopularContributions />);
  await settle();

  expect(screen.queryByTestId("home-popular-contributions")).toBeNull();
});

it("lists the walks in the order the server ranked them, with likes and credit", async () => {
  mockGetPopular.mockResolvedValue([card("a", "Ljungåsen runt", 234, "Vandrarvennen"), card("b", "Viskan", 12, null)]);
  renderWithProviders(<PopularContributions />);
  await flushUntil(() => screen.queryByTestId("home-popular-contributions"));

  const names = screen.getAllByText(/Ljungåsen runt|Viskan/).map((n) => n.props.children);
  expect(names).toEqual(["Ljungåsen runt", "Viskan"]);
  expect(screen.getByText("7,2 km · Vandrarvennen")).toBeTruthy();
  expect(screen.getByText("7,2 km")).toBeTruthy();
  expect(screen.getByText("234")).toBeTruthy();
});

it("shows at most five walks, so the home screen keeps its height", async () => {
  mockGetPopular.mockResolvedValue(Array.from({ length: 8 }, (_, i) => card(`w${i}`, `Promenad ${i}`, 8 - i, null)));
  renderWithProviders(<PopularContributions />);
  await flushUntil(() => screen.queryByTestId("home-popular-contributions"));

  expect(screen.getAllByTestId(/^home-contribution-w/)).toHaveLength(HOME_CONTRIBUTION_LIMIT);
  expect(screen.queryByTestId("home-contribution-w5")).toBeNull();
});

it("opens the trail list on the walks from show all", async () => {
  mockGetPopular.mockResolvedValue([card("a", "Ljungåsen runt", 3, null)]);
  const { store } = renderWithProviders(<PopularContributions />);
  await flushUntil(() => screen.queryByTestId("home-contributions-see-all"));

  fireEvent.press(screen.getByTestId("home-contributions-see-all"));

  expect(store.get(trailListSourceAtom)).toBe("contributions");
  expect(mockNavigate).toHaveBeenCalledWith("/(tabs)/trails");
});

it("opens the trail in the home stack", async () => {
  mockGetPopular.mockResolvedValue([card("a", "Ljungåsen runt", 3, "Vandrarvennen")]);
  renderWithProviders(<PopularContributions />);
  await flushUntil(() => screen.queryByTestId("home-contribution-a"));

  fireEvent.press(screen.getByTestId("home-contribution-a"));

  expect(mockNavigate).toHaveBeenCalledWith({
    pathname: "/(tabs)/(home)/trail/[identifier]",
    params: { identifier: "a" },
  });
});
