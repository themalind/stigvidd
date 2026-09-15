// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// Art. 7(3): withdrawing consent must be as easy as giving it. The privacy policy names this
// screen by name ("Settings → Privacy"), so these assert that the switch really reflects and
// really writes the stored choice — a toggle that looks right but persists nothing would make
// the policy false.

import { screen, fireEvent, waitFor } from "@testing-library/react-native";

import { renderWithProviders } from "@/test/render";
import AsyncStorage from "@react-native-async-storage/async-storage";

import PrivacyScreen from "@/components/settings/privacy-screen";
import { getConsent, resetConsent } from "@/services/consent";

beforeEach(async () => {
  resetConsent();
  await AsyncStorage.clear();
});

afterEach(() => {
  resetConsent();
});

it("starts off when nothing has been chosen yet", async () => {
  renderWithProviders(<PrivacyScreen />);

  await waitFor(() => expect(screen.getByTestId("privacy-stats-switch")).toBeTruthy());
  expect(screen.getByTestId("privacy-stats-switch").props.value).toBe(false);
});

it("reflects a stored grant", async () => {
  await AsyncStorage.setItem("@stigvidd_rum_consent", "granted");

  renderWithProviders(<PrivacyScreen />);

  await waitFor(() => expect(screen.getByTestId("privacy-stats-switch").props.value).toBe(true));
});

it("persists a grant when switched on", async () => {
  renderWithProviders(<PrivacyScreen />);

  await waitFor(() => expect(screen.getByTestId("privacy-stats-switch")).toBeTruthy());
  fireEvent(screen.getByTestId("privacy-stats-switch"), "valueChange", true);

  await waitFor(async () => expect(await getConsent()).toBe("granted"));
});

it("persists a withdrawal when switched off again", async () => {
  await AsyncStorage.setItem("@stigvidd_rum_consent", "granted");
  renderWithProviders(<PrivacyScreen />);

  await waitFor(() => expect(screen.getByTestId("privacy-stats-switch").props.value).toBe(true));
  fireEvent(screen.getByTestId("privacy-stats-switch"), "valueChange", false);

  // The half that matters legally: withdrawal has to survive the next launch, not just the
  // current render.
  await waitFor(async () => expect(await getConsent()).toBe("denied"));
});
