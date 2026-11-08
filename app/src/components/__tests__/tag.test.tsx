// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import Tag from "@/components/tag";
import { AppDefaultTheme } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";

describe("Tag", () => {
  it("draws the primary tone on the primary container by default", async () => {
    await renderWithProviders(<Tag testID="tag" label="Arrangör" />);

    expect(screen.getByTestId("tag")).toHaveStyle({ backgroundColor: AppDefaultTheme.colors.primaryContainer });
    expect(screen.getByText("Arrangör")).toHaveStyle({ color: AppDefaultTheme.colors.onPrimaryContainer });
  });

  it("draws the secondary tone with its icon in the same colour as the label", async () => {
    await renderWithProviders(<Tag testID="tag" label="Privat" tone="secondary" icon="lock-outline" />);

    expect(screen.getByTestId("tag")).toHaveStyle({ backgroundColor: AppDefaultTheme.colors.secondaryContainer });
    expect(screen.getByText("Privat")).toHaveStyle({ color: AppDefaultTheme.colors.onSecondaryContainer });
    expect(screen.getByTestId("icon-lock-outline").props.color).toBe(AppDefaultTheme.colors.onSecondaryContainer);
  });
});
