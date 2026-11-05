// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ContributionInfo from "@/components/trail/contribution-info";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const TITLE = "Om användarpromenader";

async function open() {
  renderWithProviders(<ContributionInfo />);
  fireEvent.press(screen.getByTestId("contribution-info-button"));
  await settle();
}

it("stays closed until the button is pressed", () => {
  renderWithProviders(<ContributionInfo />);

  expect(screen.queryByText(TITLE)).toBeNull();
  expect(screen.getByLabelText(TITLE)).toBeTruthy();
});

it("says the walk is user-made, self-assessed, unmarked and walked at one's own risk", async () => {
  await open();

  expect(screen.getByText(TITLE)).toBeTruthy();
  expect(screen.getAllByTestId("contribution-info-card")).toHaveLength(4);
  expect(screen.getByText(/ingen officiell led/)).toBeTruthy();
  expect(screen.getByText(/Svårighetsgraden är användarens egen bedömning\./)).toBeTruthy();
  expect(screen.getByText(/Användarpromenader är inte märkta med någon ledsymbol/)).toBeTruthy();
  expect(screen.getByText("Du går på eget ansvar")).toBeTruthy();
});

it("closes from the Ok button", async () => {
  await open();

  fireEvent.press(screen.getByTestId("contribution-info-ok"));
  // keep-comment: Paper's Modal stays mounted until its exit animation ends
  await flushUntil(() => screen.queryByText(TITLE) === null);

  expect(screen.queryByText(TITLE)).toBeNull();
});
