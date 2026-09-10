// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import TrailDescription from "@/components/trail/trail-description";
import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { Trail } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";

type Theme = typeof AppDefaultTheme | typeof AppDarkTheme;

const DESCRIPTION = "Knalleleden går genom skog och över hällmark, med utsikt över sjön från den högsta punkten.";

function show(description: string | null = DESCRIPTION, theme: Theme = AppDefaultTheme) {
  return renderWithProviders(<TrailDescription trail={{ identifier: "t1", description } as Trail} />, { theme });
}

it("heads the section and prints the trail's own description", () => {
  show();

  expect(screen.getByText("Beskrivning")).toBeTruthy();
  expect(screen.getByText(DESCRIPTION)).toBeTruthy();
});

// A trail imported without one must leave an empty section rather than crash the screen.
it("renders the heading alone when the trail has no description", () => {
  show(null);

  expect(screen.getByText("Beskrivning")).toBeTruthy();
  expect(screen.queryByText(DESCRIPTION)).toBeNull();
});

it("sets the heading apart from the body text", () => {
  show();

  expect(screen.getByText("Beskrivning")).toHaveStyle({ fontWeight: "700", fontSize: 15 });
  // Loose leading, because the description is the longest read on the screen.
  expect(screen.getByText(DESCRIPTION)).toHaveStyle({ fontSize: 15, lineHeight: 25 });
});

it("sits on the theme's surface as a rounded card", () => {
  show();

  expect(screen.getByTestId("trail-description")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.surface,
    borderRadius: SURFACE_BORDER_RADIUS,
    padding: 20,
  });
});

it("follows the dark theme too", () => {
  show(DESCRIPTION, AppDarkTheme);

  expect(screen.getByTestId("trail-description")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.surface });
  expect(screen.getByText(DESCRIPTION)).toHaveStyle({ color: AppDarkTheme.colors.onSurface });
});
