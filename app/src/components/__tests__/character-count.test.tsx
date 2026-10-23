// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import CharacterCount from "@/components/character-count";
import { AppDefaultTheme } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";

it("shows the length against the limit", () => {
  renderWithProviders(<CharacterCount testID="count" value="hej" max={40} />);

  expect(screen.getByTestId("count")).toHaveTextContent("3/40");
  expect(screen.getByTestId("count")).toHaveStyle({ color: AppDefaultTheme.colors.onSurfaceVariant });
});

it("counts an empty field as zero", () => {
  renderWithProviders(<CharacterCount testID="count" value={undefined} max={300} />);

  expect(screen.getByTestId("count")).toHaveTextContent("0/300");
});

it("turns red once the limit is reached", () => {
  renderWithProviders(<CharacterCount testID="count" value={"a".repeat(40)} max={40} />);

  expect(screen.getByTestId("count")).toHaveTextContent("40/40");
  expect(screen.getByTestId("count")).toHaveStyle({ color: AppDefaultTheme.colors.error });
});
