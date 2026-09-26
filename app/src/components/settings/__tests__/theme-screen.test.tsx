// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { userThemeAtom } from "@/atoms/user-theme-atom";
import ThemeScreen from "@/components/settings/theme-screen";
import { APP_THEMES, AppDefaultTheme, type ThemeChoice } from "@/constants/theme";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, screen } from "@testing-library/react-native";

function show(choice: ThemeChoice = "auto") {
  return renderWithProviders(<ThemeScreen />, { initialAtoms: [[userThemeAtom, choice]] });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

it("offers the system choice and every theme, by name", () => {
  show();

  expect(screen.getByText("Följ systemet")).toBeTruthy();
  for (const name of [
    "Petroleum",
    "Havsbris",
    "Midsommar",
    "Lingonris",
    "Bergsdimma",
    "Bivack",
    "Norrsken",
    "Stjärnhimmel",
    "Ljungnatt",
    "Skifferkväll",
  ]) {
    expect(screen.getByText(name)).toBeTruthy();
  }
  expect(screen.getAllByRole("radio")).toHaveLength(APP_THEMES.length + 1);
});

it("groups the light themes before the dark ones", () => {
  show();

  const texts = screen.getAllByText(/^(Ljusa|Mörka|Havsbris|Norrsken)$/).map((node) => node.props.children);
  expect(texts).toEqual(["Ljusa", "Havsbris", "Mörka", "Norrsken"]);
});

it("marks only the current choice as checked", () => {
  show("midsommar");

  expect(screen.getByTestId("theme-option-midsommar").props.accessibilityState).toEqual({ checked: true });
  expect(screen.getByTestId("theme-option-auto").props.accessibilityState).toEqual({ checked: false });
  expect(screen.getByTestId("theme-option-midsommar")).toHaveStyle({
    borderColor: AppDefaultTheme.colors.primary,
    borderWidth: 2,
  });
});

it("applies a picked theme at once and stores it for the next start", async () => {
  const { store } = show();

  fireEvent.press(screen.getByTestId("theme-option-norrsken"));
  await settle();

  expect(store.get(userThemeAtom)).toBe("norrsken");
  expect(AsyncStorage.setItem).toHaveBeenCalledWith("my-theme", "norrsken");
  expect(screen.getByTestId("theme-option-norrsken").props.accessibilityState).toEqual({ checked: true });
});

// The old toggle had no way back to following the phone; this screen must.
it("goes back to following the system", async () => {
  const { store } = show("bivack");

  fireEvent.press(screen.getByTestId("theme-option-auto"));
  await settle();

  expect(store.get(userThemeAtom)).toBe("auto");
  expect(AsyncStorage.setItem).toHaveBeenCalledWith("my-theme", "auto");
});

it("draws each preview in its own theme's colours, not the one on screen", () => {
  show();
  const norrsken = APP_THEMES.find((t) => t.id === "norrsken")?.theme;
  if (!norrsken) throw new Error("expected norrsken");

  expect(screen.getByTestId("theme-preview-norrsken")).toHaveStyle({ backgroundColor: norrsken.colors.background });
});
