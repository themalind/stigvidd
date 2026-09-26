// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { APP_THEMES, AppDarkTheme, AppDefaultTheme, resolveTheme } from "@/constants/theme";

it.each([
  ["light", AppDefaultTheme],
  ["dark", AppDarkTheme],
  [null, AppDefaultTheme],
])("follows a %s system with the default pair", (scheme, expected) => {
  expect(resolveTheme("auto", scheme)).toBe(expected);
});

it("ignores the system once a theme is picked", () => {
  const havsbris = APP_THEMES.find((t) => t.id === "havsbris")?.theme;
  if (!havsbris) throw new Error("expected havsbris");

  expect(resolveTheme("havsbris", "dark")).toBe(havsbris);
});

// The dark flag picks the status bar, navigation bar and blur tint.
it("marks every theme dark exactly when its background is dark", () => {
  for (const { id, theme } of APP_THEMES) {
    const lightness = Number(/(\d+)%\)$/.exec(theme.colors.background)?.[1] ?? NaN);
    expect({ id, dark: theme.dark }).toEqual({ id, dark: lightness < 50 });
  }
});
