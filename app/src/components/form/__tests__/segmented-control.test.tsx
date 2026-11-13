// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import SegmentedControl from "@/components/form/segmented-control";
import { AppDefaultTheme } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const OPTIONS = [
  { value: "a", label: "Alfa" },
  { value: "b", label: "Beta" },
] as const;

async function show(value: "a" | "b", onChange = jest.fn()) {
  await renderWithProviders(<SegmentedControl testID="seg" options={[...OPTIONS]} value={value} onChange={onChange} />);
  return onChange;
}

it("marks only the chosen segment as selected", async () => {
  await show("b");

  expect(screen.getByTestId("seg-a").props.accessibilityState).toMatchObject({ selected: false });
  expect(screen.getByTestId("seg-b").props.accessibilityState).toMatchObject({ selected: true });
  expect(screen.getByTestId("seg-b")).toHaveStyle({ backgroundColor: AppDefaultTheme.colors.primaryContainer });
  expect(screen.getByText("Beta")).toHaveStyle({ color: AppDefaultTheme.colors.onPrimaryContainer });
  expect(screen.getByTestId("seg-a")).not.toHaveStyle({ backgroundColor: AppDefaultTheme.colors.primaryContainer });
});

// keep-comment: "Från användare" wrapped onto two lines at a large system text size
it("keeps a label on one line, shrinking it to fit its segment", async () => {
  await show("a");

  const label = screen.getByText("Alfa");
  expect(label.props.numberOfLines).toBe(1);
  expect(label.props.adjustsFontSizeToFit).toBe(true);
  expect(label).toHaveStyle({ flexShrink: 1 });
});

it("reports the pressed segment's value", async () => {
  const onChange = await show("a");

  await fireEvent.press(screen.getByTestId("seg-b"));

  expect(onChange).toHaveBeenCalledWith("b");
});

it("shows a segment's badge only when it counts something", async () => {
  await renderWithProviders(
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
});

it("draws the badge large enough to read, orange with bold white digits", async () => {
  await renderWithProviders(
    <SegmentedControl
      testID="seg"
      options={[
        { value: "a", label: "Alfa" },
        { value: "b", label: "Beta", badge: 8 },
      ]}
      value="a"
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByTestId("seg-b-badge")).toHaveStyle({
    height: 22,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    backgroundColor: AppDefaultTheme.colors.tertiary,
    color: AppDefaultTheme.colors.onTertiary,
  });
});

it("centres the badge beside the label, not at the bottom where Paper puts it", async () => {
  await renderWithProviders(
    <SegmentedControl
      testID="seg"
      options={[{ value: "a", label: "Alfa", badge: 5 }]}
      value="a"
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByTestId("seg-a-badge")).toHaveStyle({ alignSelf: "center" });
});

it("keeps the same orange badge, without a ring, on the chosen segment", async () => {
  await renderWithProviders(
    <SegmentedControl
      testID="seg"
      options={[{ value: "a", label: "Alfa", badge: 8 }]}
      value="a"
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByTestId("seg-a-badge")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.tertiary,
    color: AppDefaultTheme.colors.onTertiary,
  });
  expect(screen.getByTestId("seg-a-badge")).not.toHaveStyle({ borderWidth: 2 });
});
