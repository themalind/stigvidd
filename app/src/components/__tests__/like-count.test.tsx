// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import LikeCount from "@/components/like-count";
import { AppDefaultTheme } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";

it("shows the count in the primary colour", () => {
  renderWithProviders(<LikeCount count={7} />);

  expect(screen.getByText("7")).toHaveStyle({ color: AppDefaultTheme.colors.primary, fontSize: 14 });
});

it("shrinks the text in the small size", () => {
  renderWithProviders(<LikeCount count={0} size="small" />);

  expect(screen.getByText("0")).toHaveStyle({ fontSize: 12 });
});
