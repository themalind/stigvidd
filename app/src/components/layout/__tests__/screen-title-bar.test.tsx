// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ScreenTitleBar, { TITLE_BAR_ACTION_HEIGHT } from "@/components/layout/screen-title-bar";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

const ACTION = { testID: "title-action", label: "Filter", icon: "filter-list" as const, onPress: jest.fn() };

function style(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style);
}

it("keeps the button's slot as tall as the button when the button hides, whatever the bar's padding", async () => {
  const { rerender } = await renderWithProviders(
    <ScreenTitleBar title="Leder" action={ACTION} style={{ paddingBottom: 20 }} />,
  );
  expect(style("screen-title-bar").minHeight).toBeUndefined();
  expect(style("screen-title-bar-end").minHeight).toBe(TITLE_BAR_ACTION_HEIGHT);

  await rerender(<ScreenTitleBar title="Leder" style={{ paddingBottom: 20 }} />);

  expect(screen.queryByTestId("title-action")).toBeNull();
  expect(style("screen-title-bar-end").minHeight).toBe(TITLE_BAR_ACTION_HEIGHT);
});

it("lets the button grow past the slot's height for larger text, never clipping its label", async () => {
  await renderWithProviders(<ScreenTitleBar title="Leder" action={ACTION} />);

  const surface = screen.getByTestId("title-action").children[0];
  if (typeof surface === "string") throw new Error("expected the button's surface view");
  const button = StyleSheet.flatten(surface.props.style);
  expect(button.minHeight).toBe(TITLE_BAR_ACTION_HEIGHT);
  expect(button.height).toBeUndefined();
});
