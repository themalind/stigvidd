// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import SectionPanel from "@/components/section-panel";
import { SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { APP_THEMES } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";
import { Text } from "react-native";

describe.each(APP_THEMES)("in the $id theme", ({ theme }) => {
  it("draws the panel on the theme's surface", () => {
    renderWithProviders(
      <SectionPanel testID="panel">
        <Text>Innehåll</Text>
      </SectionPanel>,
      { theme },
    );

    expect(screen.getByTestId("panel")).toHaveStyle({
      backgroundColor: theme.colors.surface,
      marginHorizontal: SCREEN_PADDING,
      borderRadius: SURFACE_BORDER_RADIUS,
    });
    expect(screen.getByText("Innehåll")).toBeTruthy();
  });

  it("renders the title, subtitle and header action above the content", () => {
    renderWithProviders(
      <SectionPanel title="Rubrik" subtitle="Underrubrik" headerAction={<Text>Visa alla</Text>}>
        <Text>Innehåll</Text>
      </SectionPanel>,
      { theme },
    );

    expect(screen.getByText("Rubrik")).toHaveStyle({ color: theme.colors.onSurface });
    expect(screen.getByText("Underrubrik")).toHaveStyle({ color: theme.colors.onSurfaceVariant });
    expect(screen.getByText("Visa alla")).toBeTruthy();
  });

  it("renders no header without a title", () => {
    renderWithProviders(
      <SectionPanel subtitle="Underrubrik" headerAction={<Text>Visa alla</Text>}>
        <Text>Innehåll</Text>
      </SectionPanel>,
      { theme },
    );

    expect(screen.queryByText("Underrubrik")).toBeNull();
    expect(screen.queryByText("Visa alla")).toBeNull();
  });

  // keep-comment: the panels only read as frames, and the cards on them only stand out, while these two colours differ
  it("keeps the panel colour apart from the page and from cards on it", () => {
    expect(theme.colors.surface).not.toBe(theme.colors.background);
  });
});
