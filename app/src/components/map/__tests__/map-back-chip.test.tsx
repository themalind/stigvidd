// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import MapBackChip from "@/components/map/map-back-chip";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

const LONG_NAME = "Byttorp, kolbränningen och den långa sjöslingan";

it("keeps a long title on one line, cut with an ellipsis", async () => {
  await renderWithProviders(<MapBackChip title={LONG_NAME} />);

  expect(screen.getByText(LONG_NAME).props.numberOfLines).toBe(1);
  expect(screen.getByText(LONG_NAME)).toHaveStyle({ flexShrink: 1 });
});

it("pins itself top-left by default, as the follow view expects", async () => {
  await renderWithProviders(<MapBackChip title={LONG_NAME} />);

  expect(screen.getByRole("button")).toHaveStyle({ position: "absolute", maxWidth: "70%" });
});

// keep-comment: beside the area map's filter it must shrink to the room left, not take a fixed share and run under it
it("shrinks to the room its row leaves when inline", async () => {
  await renderWithProviders(<MapBackChip title={LONG_NAME} inline />);

  const chip = screen.getByRole("button");
  expect(chip).toHaveStyle({ flexShrink: 1 });
  expect(chip).not.toHaveStyle({ position: "absolute" });
});

it("goes back when pressed", async () => {
  await renderWithProviders(<MapBackChip title={LONG_NAME} inline />);

  await fireEvent.press(screen.getByRole("button"));

  expect(mockBack).toHaveBeenCalled();
});
