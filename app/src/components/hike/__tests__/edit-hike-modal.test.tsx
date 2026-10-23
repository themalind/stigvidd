// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import EditHikeModal from "@/components/hike/edit-hike-modal";
import { Hike } from "@/data/types";
import { captureKeyboard } from "@/test/keyboard";
import { renderWithProviders } from "@/test/render";
import { AppDefaultTheme } from "@/constants/theme";
import { fireEvent, screen } from "@testing-library/react-native";
import { Dimensions, StyleSheet } from "react-native";

const HIKE: Hike = {
  identifier: "hike-1",
  name: "Kvällstur",
  hikeLength: 5,
  duration: 3600,
  createdBy: "user-1",
  createdAt: "2026-10-01T10:00:00Z",
  images: [],
};

it("lifts and shrinks the card above the iOS keyboard so the save button stays reachable", () => {
  const keyboard = captureKeyboard();
  renderWithProviders(<EditHikeModal hike={HIKE} onDismiss={jest.fn()} onSave={jest.fn()} />);

  keyboard.show(300);

  expect(screen.getByTestId("modal-wrapper")).toHaveStyle({ marginBottom: 310 });
  const { maxHeight } = StyleSheet.flatten(screen.getByTestId("edit-hike-card").props.style);
  expect(maxHeight).toBeLessThanOrEqual(Dimensions.get("window").height - 310 - 10);

  keyboard.hide();

  expect(screen.getByTestId("modal-wrapper")).not.toHaveStyle({ marginBottom: 310 });
});

it("counts the characters in each field and turns the count red at the limit", () => {
  renderWithProviders(<EditHikeModal hike={HIKE} onDismiss={jest.fn()} onSave={jest.fn()} />);

  expect(screen.getByTestId("edit-name-count")).toHaveTextContent("9/40");
  expect(screen.getByTestId("edit-description-count")).toHaveTextContent("0/500");

  fireEvent.changeText(screen.getByTestId("edit-gettingThere"), "a".repeat(200));

  expect(screen.getByTestId("edit-gettingThere-count")).toHaveTextContent("200/200");
  expect(screen.getByTestId("edit-gettingThere-count")).toHaveStyle({ color: AppDefaultTheme.colors.error });
  expect(screen.getByTestId("edit-parkingInfo-count")).not.toHaveStyle({ color: AppDefaultTheme.colors.error });
});

it("caps the card's height with no keyboard up, so the form scrolls instead of outgrowing the screen", () => {
  renderWithProviders(<EditHikeModal hike={HIKE} onDismiss={jest.fn()} onSave={jest.fn()} />);

  const { maxHeight } = StyleSheet.flatten(screen.getByTestId("edit-hike-card").props.style);
  expect(maxHeight).toBe(Dimensions.get("window").height * 0.85);
});
