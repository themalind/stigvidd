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

import { screen, fireEvent, waitFor, within } from "@testing-library/react-native";

import { BORDER_RADIUS } from "@/constants/constants";
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

it("uses the shared header, and the app's corner radius on the row", async () => {
  await renderWithProviders(<PrivacyScreen />);

  expect(within(screen.getByTestId("screen-header-bar")).getByTestId("back-button")).toBeTruthy();
  expect(screen.getByRole("header", { name: "Integritet" })).toBeTruthy();
  expect(screen.getByTestId("privacy-stats-row")).toHaveStyle({ borderRadius: BORDER_RADIUS });
});

// keep-comment: the app header above already clears the status bar, so adding its inset here doubled the gap
it("leaves the status bar to the app header instead of adding its inset again", async () => {
  await renderWithProviders(<PrivacyScreen />);

  expect(screen.getByTestId("privacy-screen").props.contentContainerStyle).toMatchObject({ paddingTop: 8 });
});

it("starts off when nothing has been chosen yet", async () => {
  await renderWithProviders(<PrivacyScreen />);

  await waitFor(() => expect(screen.getByTestId("privacy-stats-switch")).toBeTruthy());
  expect(screen.getByTestId("privacy-stats-switch").props.value).toBe(false);
});

it("reflects a stored grant", async () => {
  await AsyncStorage.setItem("@stigvidd_rum_consent", "granted");

  await renderWithProviders(<PrivacyScreen />);

  await waitFor(() => expect(screen.getByTestId("privacy-stats-switch").props.value).toBe(true));
});

it("persists a grant when switched on", async () => {
  await renderWithProviders(<PrivacyScreen />);

  await waitFor(() => expect(screen.getByTestId("privacy-stats-switch")).toBeTruthy());
  await fireEvent(screen.getByTestId("privacy-stats-switch"), "valueChange", true);

  await waitFor(async () => expect(await getConsent()).toBe("granted"));
});

it("persists a withdrawal when switched off again", async () => {
  await AsyncStorage.setItem("@stigvidd_rum_consent", "granted");
  await renderWithProviders(<PrivacyScreen />);

  await waitFor(() => expect(screen.getByTestId("privacy-stats-switch").props.value).toBe(true));
  await fireEvent(screen.getByTestId("privacy-stats-switch"), "valueChange", false);

  // The half that matters legally: withdrawal has to survive the next launch, not just the
  // current render.
  await waitFor(async () => expect(await getConsent()).toBe("denied"));
});
