// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import DialogFrame, { DialogAction } from "@/components/dialog/dialog-frame";
import { SCRIM_COLOR } from "@/components/dialog/modal-scrim";
import { DIALOG_BORDER_RADIUS } from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { Text } from "react-native";

const onDismiss = jest.fn();
const onConfirm = jest.fn();

function show(
  props: Partial<React.ComponentProps<typeof DialogFrame>> = {},
  theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme,
) {
  const actions: DialogAction[] = props.actions ?? [
    { label: "Ta bort", onPress: onConfirm, testID: "confirm" },
    { label: "Avbryt", onPress: onDismiss, variant: "text", testID: "cancel" },
  ];
  return renderWithProviders(
    <DialogFrame visible onDismiss={onDismiss} title="Ta bort promenad" {...props} actions={actions}>
      <Text>Vill du ta bort promenaden?</Text>
    </DialogFrame>,
    { theme },
  );
}

function icon(name: string) {
  return screen.getByTestId(`icon-${name}`, { includeHiddenElements: true });
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows its title, its body and its buttons", () => {
  show();

  expect(screen.getByText("Ta bort promenad")).toBeTruthy();
  expect(screen.getByText("Vill du ta bort promenaden?")).toBeTruthy();
  expect(screen.getByText("Ta bort")).toBeTruthy();
  expect(screen.getByText("Avbryt")).toBeTruthy();
});

it("renders nothing, and dims nothing, while it is hidden", () => {
  show({ visible: false });

  expect(screen.queryByText("Ta bort promenad")).toBeNull();
  expect(screen.queryByTestId("modal-scrim", { includeHiddenElements: true })).toBeNull();
});

it("dims the screen behind it like the app's other modals", () => {
  show();

  expect(screen.getByTestId("modal-scrim", { includeHiddenElements: true })).toHaveStyle({
    backgroundColor: SCRIM_COLOR,
  });
});

it("sits on the theme's surface with the shared radius, in both themes", () => {
  const { unmount } = show();
  expect(screen.getByTestId("dialog-surface")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.surface,
    borderRadius: DIALOG_BORDER_RADIUS,
  });

  unmount();
  show({}, AppDarkTheme);
  expect(screen.getByTestId("dialog-surface")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.surface });
});

it("leads the title with a small icon in the accent colour", () => {
  show({ icon: "lock-outline" });

  expect(icon("lock-outline").props.size).toBe(18);
  expect(icon("lock-outline").props.color).toBe(AppDefaultTheme.colors.primary);
  expect(screen.getByText("Ta bort promenad")).toHaveStyle({ fontSize: 18, fontWeight: "700", letterSpacing: 0.4 });
  expect(screen.getByTestId("dialog-header")).toHaveStyle({ flexDirection: "row", justifyContent: "space-between" });
});

it("turns the icon red for a destructive dialog", () => {
  show({ icon: "delete-outline", tone: "danger" });

  expect(icon("delete-outline").props.color).toBe(AppDefaultTheme.colors.error);
});

it("offers a close cross only when asked to", async () => {
  const { rerender } = show();
  expect(screen.queryByTestId("dialog-close")).toBeNull();

  rerender(
    <DialogFrame visible onDismiss={onDismiss} title="Info" showClose actions={[]}>
      <Text>Text</Text>
    </DialogFrame>,
  );
  fireEvent.press(screen.getByTestId("dialog-close"));
  await settle();

  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("dialog-close").props.accessibilityLabel).toBe("Stäng");
});

it("calls back the button that was pressed", () => {
  show();

  fireEvent.press(screen.getByTestId("confirm"));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onDismiss).not.toHaveBeenCalled();

  fireEvent.press(screen.getByTestId("cancel"));
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

it("fills the main button and leaves the secondary one as text", () => {
  show();

  expect(screen.getByTestId("confirm-container")).toHaveStyle({ backgroundColor: AppDefaultTheme.colors.primary });
  expect(screen.getByTestId("cancel-container")).not.toHaveStyle({ backgroundColor: AppDefaultTheme.colors.primary });
});

it("paints a danger button in the error colour", () => {
  show({
    actions: [
      { label: "Ta bort", onPress: onConfirm, variant: "danger", testID: "confirm" },
      { label: "Avbryt", onPress: onDismiss, variant: "text", testID: "cancel" },
    ],
  });

  expect(screen.getByTestId("confirm-container")).toHaveStyle({ backgroundColor: AppDefaultTheme.colors.error });
});

it("closes on a tap outside", async () => {
  show();

  fireEvent.press(screen.getByTestId("dialog-backdrop"));
  await settle();

  expect(onDismiss).toHaveBeenCalledTimes(1);
});

it("stays put on a tap outside when it needs an explicit answer", async () => {
  show({ dismissable: false });

  fireEvent.press(screen.getByTestId("dialog-backdrop"));
  await settle();

  expect(onDismiss).not.toHaveBeenCalled();
});
