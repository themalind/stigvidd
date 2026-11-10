// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import TrailTitle from "@/components/trail/trail-title";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";

describe("the trail's title", () => {
  it("shows the city under the name", async () => {
    await renderWithProviders(<TrailTitle name="Ryssnässlingan" city="Borås" />);

    expect(screen.getByText("Ryssnässlingan")).toBeTruthy();
    expect(screen.getByText("Borås")).toBeTruthy();
  });

  // The API sends "" for a trail without a city.
  it.each(["", "   "])("leaves out the city line when the city is %j", async (city) => {
    await renderWithProviders(<TrailTitle name="Ryssnässlingan" city={city} />);

    expect(screen.queryByTestId("trail-title-city")).toBeNull();
  });
});
