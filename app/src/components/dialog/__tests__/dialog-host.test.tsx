// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { DialogHost } from "@/components/dialog/dialog-host";
import { getDialog, hideDialog, showDialog } from "@/services/dialog";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen } from "@testing-library/react-native";

const onOpen = jest.fn();

function ask() {
  act(() => {
    showDialog({
      title: "Vägbeskrivning",
      message: "Öppna kartappen?",
      icon: "directions",
      actions: [
        { label: "Öppna", onPress: onOpen },
        { label: "Avbryt", variant: "text" },
      ],
    });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  act(() => hideDialog());
});

it("draws nothing until something asks", () => {
  renderWithProviders(<DialogHost />);

  expect(screen.queryByTestId("dialog-host")).toBeNull();
});

it("draws what was asked for", () => {
  renderWithProviders(<DialogHost />);

  ask();

  expect(screen.getByText("Vägbeskrivning")).toBeTruthy();
  expect(screen.getByText("Öppna kartappen?")).toBeTruthy();
  expect(screen.getByText("Öppna")).toBeTruthy();
});

it("closes and runs the action that was pressed", async () => {
  renderWithProviders(<DialogHost />);
  ask();

  fireEvent.press(screen.getByText("Öppna"));
  await settle();

  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(getDialog()).toBeNull();
  expect(screen.queryByText("Vägbeskrivning")).toBeNull();
});

it("closes on an action that has nothing to run", async () => {
  renderWithProviders(<DialogHost />);
  ask();

  fireEvent.press(screen.getByText("Avbryt"));
  await settle();

  expect(onOpen).not.toHaveBeenCalled();
  expect(getDialog()).toBeNull();
});

it("closes on a tap outside", async () => {
  renderWithProviders(<DialogHost />);
  ask();

  fireEvent.press(screen.getByTestId("dialog-host-backdrop"));
  await settle();

  expect(getDialog()).toBeNull();
});
