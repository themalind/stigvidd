// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import OverflowMenu from "@/components/layout/overflow-menu";
import { flushUntil, flushUntilGone } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const onEdit = jest.fn();

function show() {
  return renderWithProviders(
    <OverflowMenu
      testID="menu"
      accessibilityLabel="Mer"
      items={[
        { icon: "pencil", title: "Redigera", onPress: onEdit },
        { icon: "delete", title: "Ta bort", onPress: jest.fn(), visible: false },
      ]}
    />,
  );
}

async function open() {
  await fireEvent.press(screen.getByTestId("menu"));
  await flushUntil(() => screen.queryByText("Redigera"));
}

beforeEach(() => {
  jest.clearAllMocks();
});

// A row that has just scrolled into view can be pressed before Paper's mount animation has ended.
it("opens when pressed right after it mounted", async () => {
  await show();

  await open();

  expect(screen.getByText("Redigera")).toBeTruthy();
});

it("leaves out an item that is not visible", async () => {
  await show();

  await open();

  expect(screen.queryByText("Ta bort")).toBeNull();
});

it("closes before the chosen action runs, and opens again", async () => {
  await show();
  await open();

  await fireEvent.press(screen.getByText("Redigera"));
  await flushUntilGone(() => screen.queryByText("Redigera"));

  expect(onEdit).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Redigera")).toBeNull();

  await open();
  expect(screen.getByText("Redigera")).toBeTruthy();
});

it("shows nothing when no item is visible", async () => {
  await renderWithProviders(
    <OverflowMenu
      testID="menu"
      accessibilityLabel="Mer"
      items={[{ icon: "pencil", title: "Redigera", onPress: onEdit, visible: false }]}
    />,
  );

  expect(screen.queryByTestId("menu")).toBeNull();
});
