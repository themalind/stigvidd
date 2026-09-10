// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { snackbarAtom } from "@/atoms/snackbar-atoms";
import ResetPasswordModal from "@/components/auth/reset-password-modal";
import { BORDER_RADIUS } from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { BlurView } from "expo-blur";
import { Dimensions, StyleSheet } from "react-native";
import { Button } from "react-native-paper";

const mockPasswordReset = jest.fn();

jest.mock("@/api/auth", () => ({
  userPasswordReset: (...args: unknown[]) => mockPasswordReset(...args),
}));

const WIDTH = Dimensions.get("screen").width;
const EMAIL = "vandrare@stigvidd.se";
const TITLE = "Återställ ditt lösenord";
const FAILURE = "Ett oväntat fel inträffade";
const SENT = "Kolla din e-post! Kika även i skräpposten.";

const onDismiss = jest.fn();

function show(visible = true, theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme) {
  return renderWithProviders(<ResetPasswordModal visible={visible} onDismiss={onDismiss} />, { theme });
}

function type(email: string) {
  fireEvent.changeText(screen.getByTestId("reset-password-email"), email);
}

async function send() {
  fireEvent.press(screen.getByText("Skicka"));
  await settle();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPasswordReset.mockResolvedValue({ success: true, error: null });
});

it("asks for an address, and says where the mail will turn up", () => {
  show();

  expect(screen.getByText(TITLE)).toBeTruthy();
  expect(screen.getByTestId("reset-password-email")).toBeTruthy();
  expect(screen.getByText("Skicka")).toBeTruthy();
  expect(screen.getByText("Får du inget mail? Kika i din skräppost!")).toBeTruthy();
});

it("stays out of sight until it is opened", () => {
  show(false);

  expect(screen.queryByText(TITLE)).toBeNull();
  expect(screen.UNSAFE_queryByType(BlurView)).toBeNull();
});

it("closes without sending anything when the close icon is pressed", async () => {
  show();

  fireEvent.press(screen.getByTestId("reset-password-close"));
  await settle();

  expect(onDismiss).toHaveBeenCalled();
  expect(mockPasswordReset).not.toHaveBeenCalled();
});

it("refuses an empty submission, and mails nobody", async () => {
  show();

  await send();
  await flushUntil(() => screen.queryByText("Du måste ange en e-post"));

  expect(screen.getByText("Du måste ange en e-post")).toBeTruthy();
  expect(mockPasswordReset).not.toHaveBeenCalled();
});

// A reset mail goes to whatever address is typed, so a typo is caught here.
it("refuses an address that is not one", async () => {
  show();

  type("vandrare@");
  await send();
  await flushUntil(() => screen.queryByText("Ange en giltig e-post"));

  expect(screen.getByText("Ange en giltig e-post")).toBeTruthy();
  expect(mockPasswordReset).not.toHaveBeenCalled();
});

it("marks the field itself, not only the message, when the address is refused", async () => {
  show();

  type("vandrare@");
  await send();
  await flushUntil(() => screen.queryByText("Ange en giltig e-post"));

  // The error prop never reaches the native input; Paper paints the label and underline instead.
  for (const label of screen.getAllByText("Ange e-post")) {
    expect(label).toHaveStyle({ color: AppDefaultTheme.colors.error });
  }
});

it("asks the backend to mail exactly the address that was typed", async () => {
  show();

  type(EMAIL);
  await send();

  expect(mockPasswordReset).toHaveBeenCalledWith(EMAIL);
});

it("closes and says to check the inbox once the mail is on its way", async () => {
  const { store } = show();

  type(EMAIL);
  await send();

  expect(onDismiss).toHaveBeenCalled();
  expect(store.get(snackbarAtom)).toMatchObject({ visible: true, message: SENT, type: "success" });
});

// A server that is down is not the user's mistake, so the address stays and the modal stays open.
it("keeps the form open and says so when the request fails", async () => {
  mockPasswordReset.mockResolvedValue({ success: false, error: { code: "unknown", message: "nej" } });
  const { store } = show();

  type(EMAIL);
  await send();
  await flushUntil(() => screen.queryByText(FAILURE));

  expect(screen.getByText(FAILURE)).toBeTruthy();
  expect(screen.getByTestId("reset-password-email")).toBeTruthy();
  expect(onDismiss).not.toHaveBeenCalled();
  expect(store.get(snackbarAtom)).toMatchObject({ visible: false });
});

it("clears the previous failure when the form is submitted again", async () => {
  mockPasswordReset.mockResolvedValue({ success: false, error: { code: "unknown", message: "nej" } });
  show();

  type(EMAIL);
  await send();
  await flushUntil(() => screen.queryByText(FAILURE));

  mockPasswordReset.mockReturnValue(new Promise(() => {}));
  await send();

  expect(screen.queryByText(FAILURE)).toBeNull();
});

// Sending takes a round trip, and a second press would ask for a second mail.
it("says it is working, and takes no second press, while the mail is being sent", async () => {
  let release: (result: unknown) => void = () => {};
  mockPasswordReset.mockReturnValue(new Promise((resolve) => (release = resolve)));
  show();

  type(EMAIL);
  await send();
  await flushUntil(() => screen.queryByText("Skickar..."));

  expect(screen.getByText("Skickar...")).toBeTruthy();
  expect(screen.queryByText("Skicka")).toBeNull();
  fireEvent.press(screen.getByText("Skickar..."));
  await settle();

  expect(mockPasswordReset).toHaveBeenCalledTimes(1);

  release({ success: true, error: null });
  await settle();
});

// An address the keyboard has capitalised is a different address, and Keycloak would mail nobody.
it("leaves the address exactly as it is typed", () => {
  show();

  const field = screen.getByTestId("reset-password-email");
  expect(field.props.autoCapitalize).toBe("none");
  expect(field.props.keyboardType).toBe("email-address");
});

it("keeps the modal a fixed share of the screen, on the theme's surface", () => {
  show();

  expect(screen.getByTestId("modal-surface-outer-layer")).toHaveStyle({ width: WIDTH * 0.8, alignSelf: "center" });
  expect(screen.getByTestId("modal-surface")).toHaveStyle({
    borderRadius: BORDER_RADIUS,
    backgroundColor: AppDefaultTheme.colors.surface,
  });
});

it("draws the modal on the dark theme's surface too", () => {
  show(true, AppDarkTheme);

  expect(screen.getByTestId("modal-surface")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.surface });
});

// The login fields stay on screen behind the modal; the blur is what stops them competing with it.
it("blurs whatever is behind it while it is open", () => {
  show();

  const blur = screen.UNSAFE_getByType(BlurView);
  expect(blur.props.intensity).toBe(100);
  expect(blur.props.tint).toBe("dark");
  // BlurView is a class component, not a host element, so its style is read from the props.
  expect(StyleSheet.flatten(blur.props.style)).toMatchObject({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  });
});

it("keeps the title and the way out at opposite ends of one row", () => {
  show();

  expect(screen.getByTestId("reset-password-title-row")).toHaveStyle({
    flexDirection: "row",
    justifyContent: "space-between",
  });
  expect(screen.getByText(TITLE)).toHaveStyle({ fontWeight: 700, fontSize: 16 });
  // The close icon is a bare 24pt glyph, so the touch target is the slop rather than the icon.
  expect(screen.getByTestId("reset-password-close").props.hitSlop).toBe(12);
});

it("rounds the send button the same way as the modal around it", () => {
  show();

  expect(StyleSheet.flatten(screen.UNSAFE_getByType(Button).props.style)).toMatchObject({
    borderRadius: BORDER_RADIUS,
  });
});

// A long message has to wrap inside the modal rather than widen it past the field.
it("pins the validation message to the width of the field above it", async () => {
  show();

  await send();
  await flushUntil(() => screen.queryByTestId("reset-password-email-error"));

  expect(screen.getByTestId("reset-password-email-error")).toHaveStyle({ width: WIDTH * 0.65 });
});

it("paints the validation message in the theme's error colours", async () => {
  show(true, AppDarkTheme);

  await send();
  await flushUntil(() => screen.queryByText("Du måste ange en e-post"));

  expect(screen.getByText("Du måste ange en e-post")).toHaveStyle({
    color: AppDarkTheme.colors.onErrorContainer,
    backgroundColor: AppDarkTheme.colors.errorContainer,
    borderRadius: BORDER_RADIUS,
    fontSize: 13,
  });
});

it("paints the failed request in the theme's error colour", async () => {
  mockPasswordReset.mockResolvedValue({ success: false, error: { code: "unknown", message: "nej" } });
  show();

  type(EMAIL);
  await send();
  await flushUntil(() => screen.queryByText(FAILURE));

  expect(screen.getByText(FAILURE)).toHaveStyle({ color: AppDefaultTheme.colors.error, fontSize: 15 });
});

it("centres the hint under the button", () => {
  show();

  expect(screen.getByText("Får du inget mail? Kika i din skräppost!")).toHaveStyle({ textAlign: "center" });
});
