// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// The first thing a new install shows: a statistics consent, and beside it the location
// disclosure. Only the consent is what the buttons decide.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { ConsentDialog } from "@/components/settings/consent-dialog";
import sv from "@/i18n/locales/sv.json";
import { getConsent, loadConsent, resetConsent } from "@/services/consent";
import { renderWithProviders } from "@/test/render";

jest.mock("@/services/analytics", () => ({ track: jest.fn() }));

beforeEach(async () => {
  resetConsent();
  await AsyncStorage.clear();
});

afterEach(() => {
  resetConsent();
});

async function showDialog() {
  const rendered = renderWithProviders(<ConsentDialog />);
  await loadConsent();
  await waitFor(() => expect(screen.getByTestId("consent-dialog")).toBeOnTheScreen());
  return rendered;
}

it("explains what the position is used for, beside the statistics question", async () => {
  await showDialog();

  expect(screen.getByTestId("consent-location-note")).toHaveTextContent(sv.privacy.askLocationNote);
});

// The location disclosure is information, so it gets no button of its own.
it("offers exactly the two statistics answers and no third button", async () => {
  await showDialog();

  // Paper mounts its own backdrop as a pressable; the dialog's real actions are the rest.
  const actions = screen.getAllByRole("button").filter((button) => button.props.accessibilityLabel !== "Close modal");

  expect(actions).toHaveLength(2);
  expect(screen.getByText(sv.privacy.accept)).toBeOnTheScreen();
  expect(screen.getByText(sv.privacy.decline)).toBeOnTheScreen();
});

// useUserLocation waits on the answer rather than on a yes, so a refusal still frees the map.
it("records a refusal as the answer that it is", async () => {
  await showDialog();

  fireEvent.press(screen.getByTestId("consent-decline"));

  await waitFor(async () => expect(await getConsent()).toBe("denied"));
  expect(screen.queryByTestId("consent-dialog")).toBeNull();
});
