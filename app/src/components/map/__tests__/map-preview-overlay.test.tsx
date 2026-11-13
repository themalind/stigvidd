// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import MapPreviewOverlay from "@/components/map/map-preview-overlay";
import { BORDER_RADIUS, SLIM_BUTTON_HEIGHT } from "@/constants/constants";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

jest.mock("@/utils/map/open-directions", () => ({ openDirectionsToStart: jest.fn() }));

// keep-comment: the app has one corner radius, so the preview's badges are not pills
it("draws both corner badges with the app's corner radius and slim height", async () => {
  await renderWithProviders(<MapPreviewOverlay label="Se på karta" onPress={jest.fn()} startPosition={[12.9, 57.7]} />);

  const badge = StyleSheet.flatten(screen.getByTestId("map-preview-badge").props.style);
  const directions = StyleSheet.flatten(screen.getByLabelText("Vägbeskrivning").props.style);
  for (const style of [badge, directions]) {
    expect(style.borderRadius).toBe(BORDER_RADIUS);
    expect(style.minHeight).toBe(SLIM_BUTTON_HEIGHT);
  }
});
