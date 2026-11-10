// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import NoticeBanner from "@/components/status/notice-banner";
import { AppDefaultTheme } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

describe("NoticeBanner", () => {
  it("is plain text with no chevron when there is nothing to open", async () => {
    await renderWithProviders(<NoticeBanner testID="notice" icon="history" title="Evenemanget har redan varit." />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByTestId("icon-chevron-right")).toBeNull();
    expect(screen.getByTestId("notice")).toHaveStyle({
      backgroundColor: AppDefaultTheme.colors.surfaceVariant,
      borderLeftColor: AppDefaultTheme.colors.outline,
    });
  });

  it("opens on press and shows a chevron when it leads somewhere", async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <NoticeBanner testID="notice" tone="error" icon="warning-amber" title="Hinder på leden" onPress={onPress} />,
    );

    await fireEvent.press(screen.getByRole("button"));

    expect(onPress).toHaveBeenCalled();
    expect(screen.getByTestId("icon-chevron-right")).toBeTruthy();
    expect(screen.getByTestId("notice")).toHaveStyle({
      backgroundColor: AppDefaultTheme.colors.errorContainer,
      borderLeftColor: AppDefaultTheme.colors.error,
    });
  });
});
