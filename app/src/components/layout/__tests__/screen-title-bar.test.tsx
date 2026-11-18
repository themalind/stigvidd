// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ScreenTitleBar, { TITLE_BAR_HEIGHT } from "@/components/layout/screen-title-bar";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";

const ACTION = { testID: "title-action", label: "Filter", icon: "filter-list" as const, onPress: jest.fn() };

it("is as tall without its button as with it, so hiding the button moves nothing below", async () => {
  const { rerender } = await renderWithProviders(<ScreenTitleBar title="Leder" action={ACTION} />);
  expect(screen.getByTestId("screen-title-bar")).toHaveStyle({ minHeight: TITLE_BAR_HEIGHT });

  await rerender(<ScreenTitleBar title="Leder" />);

  expect(screen.queryByTestId("title-action")).toBeNull();
  expect(screen.getByTestId("screen-title-bar")).toHaveStyle({ minHeight: TITLE_BAR_HEIGHT });
});

it("gives the button the bar's height", async () => {
  await renderWithProviders(<ScreenTitleBar title="Leder" action={ACTION} />);

  expect(screen.getByTestId("title-action").children[0]).toHaveStyle({ height: TITLE_BAR_HEIGHT });
});
