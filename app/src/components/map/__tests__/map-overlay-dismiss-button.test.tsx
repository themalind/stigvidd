// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import MapOverlayDismissButton from "@/components/map/map-overlay-dismiss-button";
import { AppDefaultTheme } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

it("is a labelled button that dismisses", async () => {
  const onPress = jest.fn();
  await renderWithProviders(<MapOverlayDismissButton onPress={onPress} />);

  const button = screen.getByRole("button", { name: "Stäng" });
  await fireEvent.press(button);

  expect(onPress).toHaveBeenCalledTimes(1);
});

it("sits on a surface so it reads against the map", async () => {
  await renderWithProviders(<MapOverlayDismissButton onPress={jest.fn()} />);

  expect(screen.getByTestId("map-overlay-dismiss")).toHaveStyle({ backgroundColor: AppDefaultTheme.colors.surface });
});
