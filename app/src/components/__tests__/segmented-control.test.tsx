// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import SegmentedControl from "@/components/segmented-control";
import { AppDefaultTheme } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const OPTIONS = [
  { value: "a", label: "Alfa" },
  { value: "b", label: "Beta" },
] as const;

function show(value: "a" | "b", onChange = jest.fn()) {
  renderWithProviders(<SegmentedControl testID="seg" options={[...OPTIONS]} value={value} onChange={onChange} />);
  return onChange;
}

it("marks only the chosen segment as selected", () => {
  show("b");

  expect(screen.getByTestId("seg-a").props.accessibilityState).toMatchObject({ selected: false });
  expect(screen.getByTestId("seg-b").props.accessibilityState).toMatchObject({ selected: true });
  expect(screen.getByTestId("seg-b")).toHaveStyle({ backgroundColor: AppDefaultTheme.colors.secondary });
});

it("reports the pressed segment's value", () => {
  const onChange = show("a");

  fireEvent.press(screen.getByTestId("seg-b"));

  expect(onChange).toHaveBeenCalledWith("b");
});

it("shows a segment's badge only when it counts something", () => {
  renderWithProviders(
    <SegmentedControl
      testID="seg"
      options={[
        { value: "a", label: "Alfa", badge: 0 },
        { value: "b", label: "Beta", badge: 3, badgeLabel: "3 nya" },
      ]}
      value="a"
      onChange={jest.fn()}
    />,
  );

  expect(screen.queryByTestId("seg-a-badge")).toBeNull();
  expect(screen.getByTestId("seg-b-badge")).toHaveTextContent("3");
  expect(screen.getByLabelText("3 nya")).toBeTruthy();
  expect(screen.getByTestId("seg-b-badge")).toHaveStyle({ backgroundColor: AppDefaultTheme.colors.tertiary });
});

it("lightens the badge on the chosen segment so it stands out from its background", () => {
  renderWithProviders(
    <SegmentedControl
      testID="seg"
      options={[{ value: "a", label: "Alfa", badge: 8 }]}
      value="a"
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByTestId("seg-a-badge")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.onSecondary,
    color: AppDefaultTheme.colors.tertiary,
  });
});
