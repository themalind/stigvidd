// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import SelectInput from "@/components/form/select-input";
import { AppDarkTheme } from "@/constants/theme";
import { getByType, queryByType } from "@/test/composites";
import { renderWithProviders } from "@/test/render";
import { Picker } from "@react-native-picker/picker";
import { fireEvent, screen } from "@testing-library/react-native";
import { Platform } from "react-native";

const options = [
  { label: "Alla orter", value: "" },
  { label: "Borås", value: "Boras" },
  { label: "Göteborg", value: "Goteborg" },
];

const onValueChange = jest.fn();

function show(selectedValue = "", props = {}) {
  return renderWithProviders(
    <SelectInput selectedValue={selectedValue} onValueChange={onValueChange} options={options} {...props} />,
  );
}

// Android mounts no Picker at all — both of its native components double-free on teardown under
// RN 0.81 — and gets plain rows instead, so both platforms are driven here.
async function asAndroid(run: () => Promise<void>) {
  const original = Platform.OS;
  Platform.OS = "android";
  try {
    await run();
  } finally {
    Platform.OS = original;
  }
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows the label of what is selected, not its value", async () => {
  await show("Boras");

  expect(screen.getByText("Borås")).toBeTruthy();
  expect(screen.queryByText("Alla orter")).toBeNull();
});

it("falls back to the placeholder when nothing matches", async () => {
  await show("nonesuch", { placeholder: "Välj ort" });

  expect(screen.getByText("Välj ort")).toBeTruthy();
});

it("opens nothing until it is pressed", async () => {
  await show();

  expect(queryByType(Picker)).toBeNull();
});

it("hands iOS a wheel carrying every option", async () => {
  await show("Boras");

  await fireEvent.press(screen.getByText("Borås"));

  const picker = getByType(Picker);
  expect(picker.props.selectedValue).toBe("Boras");
  expect(picker.props.children).toHaveLength(3);
});

it("colours the iOS wheel from the app theme, not the phone's", async () => {
  await renderWithProviders(<SelectInput selectedValue="Boras" onValueChange={onValueChange} options={options} />, {
    theme: AppDarkTheme,
  });

  await fireEvent.press(screen.getByText("Borås"));

  const picker = getByType(Picker);
  expect(picker.props.itemStyle).toEqual({ color: AppDarkTheme.colors.onSurface });
  for (const item of picker.props.children) {
    expect(item.props.color).toBe(AppDarkTheme.colors.onSurface);
  }
});

it("gives Android rows instead of a picker", async () => {
  await asAndroid(async () => {
    await show();
    await fireEvent.press(screen.getByText("Alla orter"));

    expect(queryByType(Picker)).toBeNull();
    expect(screen.getByText("Göteborg")).toBeTruthy();
  });
});

// A tap on a row is the final answer, unlike a wheel that is scrolled and confirmed.
it("reports the Android row that was tapped and closes the sheet", async () => {
  await asAndroid(async () => {
    await show();
    await fireEvent.press(screen.getByText("Alla orter"));
    await fireEvent.press(screen.getByText("Göteborg"));

    expect(onValueChange).toHaveBeenCalledWith("Goteborg");
    // Closed: the sheet's other rows are gone and only the button label is left.
    expect(screen.queryByText("Borås")).toBeNull();
  });
});

it("marks the current choice in the Android list", async () => {
  await asAndroid(async () => {
    await show("Goteborg");
    await fireEvent.press(screen.getByText("Göteborg"));

    expect(screen.getByText("✓")).toBeTruthy();
  });
});
