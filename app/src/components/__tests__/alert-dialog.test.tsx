// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AlertDialog from "@/components/alert-dialog";
import { AppDefaultTheme } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen, within } from "@testing-library/react-native";
import { Text } from "react-native";

const onDismiss = jest.fn();
const onConfirm = jest.fn();

function props(overrides: Partial<React.ComponentProps<typeof AlertDialog>> = {}) {
  return {
    visible: true,
    onDismiss,
    title: "Ta bort vandringen?",
    infoText: ["Det här går inte att ångra.", "Rutten försvinner också."],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders the title and every line of the body", () => {
  renderWithProviders(<AlertDialog {...props()} />);

  expect(screen.getByText("Ta bort vandringen?")).toBeTruthy();
  expect(screen.getByText("Det här går inte att ångra.")).toBeTruthy();
  expect(screen.getByText("Rutten försvinner också.")).toBeTruthy();
});

it("renders nothing while it is dismissed", () => {
  renderWithProviders(<AlertDialog {...props({ visible: false })} />);

  expect(screen.queryByText("Ta bort vandringen?")).toBeNull();
});

it("labels the dismiss button Ok unless the caller names it", () => {
  const { rerender } = renderWithProviders(<AlertDialog {...props()} />);
  expect(screen.getByText("Ok")).toBeTruthy();

  rerender(<AlertDialog {...props({ cancelText: "Avbryt" })} />);
  expect(screen.getByText("Avbryt")).toBeTruthy();
  expect(screen.queryByText("Ok")).toBeNull();
});

// A confirm button needs both a label and a handler, or it does nothing and no one can reach it.
it("offers confirmation only when it has both a label and a handler", () => {
  const { rerender } = renderWithProviders(<AlertDialog {...props({ confirmText: "Ta bort" })} />);
  expect(screen.queryByText("Ta bort")).toBeNull();

  rerender(<AlertDialog {...props({ onConfirm })} />);
  expect(screen.queryByText("Ta bort")).toBeNull();

  rerender(<AlertDialog {...props({ confirmText: "Ta bort", onConfirm })} />);
  expect(screen.getByText("Ta bort")).toBeTruthy();
});

it("calls back the button that was pressed", () => {
  renderWithProviders(<AlertDialog {...props({ confirmText: "Ta bort", onConfirm })} />);

  fireEvent.press(screen.getByText("Ta bort"));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onDismiss).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText("Ok"));
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

it("fills the confirm button, and the lone button when there is nothing to confirm", () => {
  const { rerender } = renderWithProviders(<AlertDialog {...props({ confirmText: "Ta bort", onConfirm })} />);
  expect(screen.getByTestId("alert-dialog-confirm-container")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.primary,
  });
  expect(screen.getByTestId("alert-dialog-cancel-container")).not.toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.primary,
  });

  rerender(<AlertDialog {...props()} />);
  expect(screen.getByTestId("alert-dialog-cancel-container")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.primary,
  });
});

it("makes a danger dialog's confirm button red", () => {
  renderWithProviders(<AlertDialog {...props({ confirmText: "Ta bort", onConfirm, tone: "danger" })} />);

  expect(screen.getByTestId("alert-dialog-confirm-container")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.error,
  });
});

it("warns in a card of its own when the action cannot be undone", () => {
  const { rerender } = renderWithProviders(<AlertDialog {...props()} />);
  expect(screen.queryByTestId("alert-dialog-warning")).toBeNull();

  rerender(<AlertDialog {...props({ irreversible: true })} />);
  expect(within(screen.getByTestId("alert-dialog-warning")).getByText("Går inte att ångra")).toBeTruthy();

  rerender(<AlertDialog {...props({ warning: "Promenaderna raderas för alltid." })} />);
  const warning = screen.getByTestId("alert-dialog-warning");
  expect(within(warning).getByText("Går inte att ångra")).toBeTruthy();
  expect(within(warning).getByText("Promenaderna raderas för alltid.")).toBeTruthy();
});

it("shows the caller's own content with the text", () => {
  renderWithProviders(
    <AlertDialog {...props()}>
      <Text>Kontakta oss på hej@stigvidd.se</Text>
    </AlertDialog>,
  );

  expect(screen.getByText("Kontakta oss på hej@stigvidd.se")).toBeTruthy();
});
