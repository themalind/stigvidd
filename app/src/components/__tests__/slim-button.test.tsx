// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import SlimButton from "@/components/slim-button";
import { SLIM_BUTTON_HEIGHT } from "@/constants/constants";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";

function content() {
  const label = screen.getByTestId("slim-text");
  let node = label.parent;
  while (node && typeof node.type !== "string") node = node.parent;
  if (!node) throw new Error("expected the button's content view");
  return node;
}

test("draws its content at the slim height", () => {
  renderWithProviders(
    <SlimButton testID="slim" mode="contained">
      Gå med
    </SlimButton>,
  );

  expect(SLIM_BUTTON_HEIGHT).toBe(32);
  expect(content()).toHaveStyle({ height: SLIM_BUTTON_HEIGHT });
});

test("keeps a caller's own content style on top", () => {
  renderWithProviders(
    <SlimButton testID="slim" contentStyle={{ flexDirection: "row-reverse" }}>
      Skapa
    </SlimButton>,
  );

  expect(content()).toHaveStyle({ height: SLIM_BUTTON_HEIGHT, flexDirection: "row-reverse" });
});
