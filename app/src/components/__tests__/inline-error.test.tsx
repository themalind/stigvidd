// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import InlineError from "@/components/inline-error";
import { AppDefaultTheme } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

it("shows the message on the page background", () => {
  renderWithProviders(<InlineError testID="error" message="Kunde inte hämta" onRetry={jest.fn()} />);

  expect(screen.getByText("Kunde inte hämta")).toBeTruthy();
  expect(screen.getByTestId("error")).toHaveStyle({ backgroundColor: AppDefaultTheme.colors.background });
});

it("calls onRetry when the retry button is pressed", () => {
  const onRetry = jest.fn();
  renderWithProviders(<InlineError message="Kunde inte hämta" onRetry={onRetry} />);

  fireEvent.press(screen.getByText("Försök igen"));

  expect(onRetry).toHaveBeenCalledTimes(1);
});
