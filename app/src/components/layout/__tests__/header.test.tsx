// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import Header from "@/components/layout/header";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

jest.mock("@/components/settings/drawer", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  return {
    __esModule: true,
    default: ({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) =>
      visible
        ? ReactActual.createElement(
            Pressable,
            { testID: "drawer", onPress: onDismiss },
            ReactActual.createElement(Text, null, "drawer"),
          )
        : null,
  };
});

it("names the settings button for a screen reader", async () => {
  await renderWithProviders(<Header />);

  expect(screen.getByRole("button", { name: "Inställningar" })).toBeTruthy();
});

it("opens the settings drawer, and closes it again", async () => {
  await renderWithProviders(<Header />);
  expect(screen.queryByTestId("drawer")).toBeNull();

  await fireEvent.press(screen.getByTestId("header-settings"));
  expect(screen.getByTestId("drawer")).toBeTruthy();

  await fireEvent.press(screen.getByTestId("drawer"));
  expect(screen.queryByTestId("drawer")).toBeNull();
});
