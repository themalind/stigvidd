// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Hike } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";
import LatestHikeCard from "../latest-hike-card";

function hike(overrides: Partial<Hike> = {}): Hike {
  return {
    identifier: "hike-1",
    name: "Kvällspromenad",
    hikeLength: 4.2,
    duration: 5_400_000,
    createdBy: "user-1",
    createdAt: new Date().toISOString(),
    coordinates: JSON.stringify([
      { latitude: 57.72, longitude: 12.94 },
      { latitude: 57.73, longitude: 12.95 },
    ]),
    ...overrides,
  };
}

// The meta line is one string built from three formatters, and a wrong unit reads as plausible.
it("renders name, distance, duration and how long ago the walk was", () => {
  renderWithProviders(<LatestHikeCard hike={hike()} />);

  expect(screen.getByText("Kvällspromenad")).toBeTruthy();
  expect(screen.getByText("4,2 km · 1,5 h · idag")).toBeTruthy();
});

it("falls back to the absolute date once the walk is older than a month", () => {
  renderWithProviders(<LatestHikeCard hike={hike({ createdAt: "2026-01-15T08:30:00Z" })} />);

  expect(screen.getByText("4,2 km · 1,5 h · 2026-01-15")).toBeTruthy();
});

// A hike with no fix has no route, and the card renders without handing the map an empty path.
it("renders no map when the hike has no coordinates", () => {
  renderWithProviders(<LatestHikeCard hike={hike({ coordinates: undefined })} />);

  expect(screen.getByText("Kvällspromenad")).toBeTruthy();
  expect(screen.queryByTestId("maplibre-Map")).toBeNull();
});

it("renders the map when the hike has a route", () => {
  renderWithProviders(<LatestHikeCard hike={hike()} />);

  expect(screen.getByTestId("maplibre-Map")).toBeTruthy();
});
