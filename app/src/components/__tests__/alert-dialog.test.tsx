// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AlertDialog from "@/components/alert-dialog";
import { DIALOG_BORDER_RADIUS } from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const onDismiss = jest.fn();
const onConfirm = jest.fn();

function props(overrides: Partial<React.ComponentProps<typeof AlertDialog>> = {}) {
  return {
    visible: true,
    onDismiss,
    title: "Ta bort vandringen?",
    infoText: ["Det här går inte att ångra.", "Rutten försvinner också."],
    backgroundColor: AppDefaultTheme.colors.surface,
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

it("keeps the caller's background and the shared dialog radius", () => {
  renderWithProviders(<AlertDialog {...props({ backgroundColor: "rgb(1, 2, 3)" })} />);

  // Paper hangs the style on the inner Surface and derives its testID from the Dialog's.
  expect(screen.getByTestId("alert-dialog-surface")).toHaveStyle({
    backgroundColor: "rgb(1, 2, 3)",
    borderRadius: DIALOG_BORDER_RADIUS,
  });
});

// The body and buttons are plain RN Text, which does not inherit Paper's colour, so a fallback is set.
it("falls back to the theme's onSurface colour, in both themes", () => {
  const { unmount } = renderWithProviders(<AlertDialog {...props({ confirmText: "Ta bort", onConfirm })} />);
  expect(screen.getByText("Det här går inte att ångra.")).toHaveStyle({ color: AppDefaultTheme.colors.onSurface });
  expect(screen.getByText("Ta bort")).toHaveStyle({ color: AppDefaultTheme.colors.onSurface });

  unmount();
  renderWithProviders(<AlertDialog {...props({ confirmText: "Ta bort", onConfirm })} />, { theme: AppDarkTheme });
  expect(screen.getByText("Det här går inte att ångra.")).toHaveStyle({ color: AppDarkTheme.colors.onSurface });
  expect(screen.getByText("Ta bort")).toHaveStyle({ color: AppDarkTheme.colors.onSurface });
});

it("lets the caller override the text colour", () => {
  renderWithProviders(<AlertDialog {...props({ textColor: "rgb(9, 9, 9)" })} />);

  expect(screen.getByText("Rutten försvinner också.")).toHaveStyle({ color: "rgb(9, 9, 9)" });
});
