// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import BackButton from "@/components/layout/back-button";
import { AppDefaultTheme } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { Platform } from "react-native";

const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: (...args: unknown[]) => mockBack(...args) },
}));

const originalOS = Platform.OS;

afterEach(() => {
  Platform.OS = originalOS;
  mockBack.mockClear();
});

it("goes back when pressed", async () => {
  Platform.OS = "ios";
  await renderWithProviders(<BackButton />);

  await fireEvent.press(screen.getByRole("button", { name: "Gå tillbaka" }));

  expect(mockBack).toHaveBeenCalledTimes(1);
});

it("is a raised round button on the surface colour, like the iOS bar buttons", async () => {
  Platform.OS = "ios";
  await renderWithProviders(<BackButton />);

  expect(screen.getByTestId("back-button")).toHaveStyle({
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppDefaultTheme.colors.surface,
    shadowOpacity: 0.12,
  });
});

it("leaves Android to its system back gesture", async () => {
  Platform.OS = "android";
  await renderWithProviders(<BackButton />);

  expect(screen.queryByTestId("back-button")).toBeNull();
});
