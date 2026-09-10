// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { AppDarkTheme } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import ProfileMenuItem from "../profile-menu-item";

const mockNavigate = jest.fn();

jest.mock("expo-router", () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  // guardedNavigate debounces on module state for 500 ms, so each call is a second later than the
  // last — which also clears the module's initial 0.
  let clock = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("navigates to the route it was given", () => {
  renderWithProviders(<ProfileMenuItem text="Mina vandringar" route="/user/my-hikes" />);

  fireEvent.press(screen.getByText("Mina vandringar"));

  expect(mockNavigate).toHaveBeenCalledWith("/user/my-hikes");
});

it("shows the badge only when there is something to count", () => {
  const { rerender } = renderWithProviders(
    <ProfileMenuItem text="Vänner" route="/(tabs)/(profile-stack)/user/friends" badge={3} />,
  );
  expect(screen.getByText("3")).toBeTruthy();

  rerender(<ProfileMenuItem text="Vänner" route="/(tabs)/(profile-stack)/user/friends" badge={0} />);
  expect(screen.queryByText("0")).toBeNull();
});

// A fixed-width row: a label on the left, a badge and chevron on the right. The label side takes
// the leftover space and gives it back; the actions side never yields any.
it("gives the label the leftover width and keeps the actions at their own size", () => {
  renderWithProviders(
    <ProfileMenuItem text="En mycket lång rubrik som inte får krocka" route="/user/my-hikes" badge={12} />,
  );

  expect(screen.getByTestId("menu-item-label-group")).toHaveStyle({ flex: 1 });
  expect(screen.getByText("En mycket lång rubrik som inte får krocka")).toHaveStyle({ flexShrink: 1 });
  expect(screen.getByTestId("menu-item-actions")).toHaveStyle({ flexShrink: 0 });
});

it("draws the badge in the theme's tertiary colours, in both themes", () => {
  const { rerender, unmount } = renderWithProviders(
    <ProfileMenuItem text="Vänner" route="/(tabs)/(profile-stack)/user/friends" badge={2} />,
  );
  expect(screen.getByText("2")).toHaveStyle({ backgroundColor: "rgb(196, 92, 38)", color: "rgb(255, 255, 255)" });

  unmount();
  renderWithProviders(<ProfileMenuItem text="Vänner" route="/(tabs)/(profile-stack)/user/friends" badge={2} />, {
    theme: AppDarkTheme,
  });
  expect(screen.getByText("2")).toHaveStyle({
    backgroundColor: AppDarkTheme.colors.tertiary,
    color: AppDarkTheme.colors.onTertiary,
  });
  void rerender;
});
