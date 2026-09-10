// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import DeleteAccountModal from "@/components/auth/delete-account-modal";
import { BORDER_RADIUS } from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { flushUntil, flushUntilGone, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { Dimensions } from "react-native";

const mockDeleteAccount = jest.fn();
const mockReplace = jest.fn();

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ deleteAccount: mockDeleteAccount }),
}));

jest.mock("expo-router", () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

// Only the error class is needed, to tell a wrong password from a server that would not delete.
jest.mock("@/services/keycloak-auth", () => {
  class InvalidCredentialsError extends Error {}
  return { InvalidCredentialsError };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { InvalidCredentialsError } = require("@/services/keycloak-auth");

const WIDTH = Dimensions.get("screen").width;
const PASSWORD = "hemligt123";
const CONFIRM_QUESTION = "Är du säker på att du vill avsluta ditt konto?";

const onDismiss = jest.fn();

function show(visible = true, theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme) {
  return renderWithProviders(<DeleteAccountModal visible={visible} onDismiss={onDismiss} />, { theme });
}

function type(password: string) {
  fireEvent.changeText(screen.getByTestId("delete-account-password"), password);
}

async function send() {
  fireEvent.press(screen.getByText("Skicka"));
  await settle();
}

// "Avsluta konto" is the modal title, the dialog title and the confirm button; the button is the last.
async function confirmDeletion() {
  const labels = screen.getAllByText("Avsluta konto");
  fireEvent.press(labels[labels.length - 1]);
  await settle();
}

async function reachConfirmation(password = PASSWORD) {
  type(password);
  await send();
  await flushUntil(() => screen.queryByText(CONFIRM_QUESTION));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteAccount.mockResolvedValue(undefined);
});

it("asks for the password before it will delete anything", () => {
  show();

  expect(screen.getByText("Skriv in ditt lösenord")).toBeTruthy();
  expect(screen.getByTestId("delete-account-password")).toBeTruthy();
  expect(screen.getByText("Skicka")).toBeTruthy();
});

it("stays out of the way until it is opened", () => {
  show(false);

  expect(screen.queryByText("Skriv in ditt lösenord")).toBeNull();
});

it("closes without deleting when the close icon is pressed", async () => {
  show();

  fireEvent.press(screen.getByTestId("delete-account-close"));
  await settle();

  expect(onDismiss).toHaveBeenCalled();
  expect(mockDeleteAccount).not.toHaveBeenCalled();
});

it("refuses an empty password, and asks nothing further", async () => {
  show();

  await send();

  expect(screen.getByText("Ange ett lösenord")).toBeTruthy();
  expect(screen.queryByText(CONFIRM_QUESTION)).toBeNull();
  expect(mockDeleteAccount).not.toHaveBeenCalled();
});

it("refuses a password shorter than the eight characters Keycloak requires", async () => {
  show();

  type("kort");
  await send();

  expect(screen.getByText("Lösenordet måste vara minst 8 tecken")).toBeTruthy();
  expect(mockDeleteAccount).not.toHaveBeenCalled();
});

// The password is right, but the account is not gone until the question is answered.
it("asks for confirmation before deleting, and deletes nothing while it asks", async () => {
  show();

  await reachConfirmation();

  expect(screen.getByText(CONFIRM_QUESTION)).toBeTruthy();
  expect(mockDeleteAccount).not.toHaveBeenCalled();
});

// Deleting an account is irreversible, so the dialog has to say what actually happens.
it("spells out what deleting the account does to the data", async () => {
  show();

  await reachConfirmation();

  expect(
    screen.getByText(
      "Ditt konto och dina promenader raderas för alltid. Promenader du delat med någon finns kvar hos mottagarna.",
    ),
  ).toBeTruthy();
  expect(
    screen.getByText(
      "Dina recensionsbetyg och hinderrapporter står kvar utan koppling till dig – texten och bilderna raderas.",
    ),
  ).toBeTruthy();
});

it("keeps the account when the confirmation is cancelled", async () => {
  show();

  await reachConfirmation();
  fireEvent.press(screen.getByText("Avbryt"));
  await flushUntilGone(() => screen.queryByText(CONFIRM_QUESTION));

  expect(mockDeleteAccount).not.toHaveBeenCalled();
  expect(screen.queryByText(CONFIRM_QUESTION)).toBeNull();
  expect(screen.getByText("Skriv in ditt lösenord")).toBeTruthy();
});

it("deletes the account with the password that was typed", async () => {
  show();

  await reachConfirmation("annat-lösenord");
  await confirmDeletion();

  expect(mockDeleteAccount).toHaveBeenCalledWith("annat-lösenord");
});

it("closes and sends the user to login once the account is gone", async () => {
  show();

  await reachConfirmation();
  await confirmDeletion();
  await flushUntil(() => mockReplace.mock.calls.length > 0);

  expect(onDismiss).toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith("/(tabs)/(profile-stack)/login");
});

// A wrong password is the user's mistake to correct, so the modal has to stay put.
it("says the password was wrong, and keeps the form open", async () => {
  mockDeleteAccount.mockRejectedValue(new InvalidCredentialsError());
  show();

  await reachConfirmation();
  await confirmDeletion();
  await flushUntil(() => screen.queryByText("Fel e-post eller lösenord."));

  expect(screen.getByText("Fel e-post eller lösenord.")).toBeTruthy();
  expect(onDismiss).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});

it("tells a failing server apart from a wrong password", async () => {
  mockDeleteAccount.mockRejectedValue(new Error("500"));
  show();

  await reachConfirmation();
  await confirmDeletion();
  await flushUntil(() => screen.queryByText("Kunde inte ta bort kontot från servern"));

  expect(screen.getByText("Kunde inte ta bort kontot från servern")).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
});

it("clears the previous failure when the form is submitted again", async () => {
  mockDeleteAccount.mockRejectedValue(new Error("500"));
  show();

  await reachConfirmation();
  await confirmDeletion();
  await flushUntil(() => screen.queryByText("Kunde inte ta bort kontot från servern"));

  await send();

  expect(screen.queryByText("Kunde inte ta bort kontot från servern")).toBeNull();
});

// Deleting takes a round trip; a second press would send a second delete.
it("says it is working, and takes no second press, while the account is being deleted", async () => {
  let release: () => void = () => {};
  mockDeleteAccount.mockReturnValue(new Promise<void>((resolve) => (release = resolve)));
  show();

  await reachConfirmation();
  await confirmDeletion();
  await flushUntil(() => screen.queryByText("Avslutar..."));
  // The confirmation is on its way out; wait for it, or "it did not come back" is meaningless.
  await flushUntilGone(() => screen.queryByText(CONFIRM_QUESTION));

  expect(screen.getByText("Avslutar...")).toBeTruthy();
  fireEvent.press(screen.getByText("Avslutar..."));
  await settle();

  // A second press must not reopen the confirmation, which is the way back to a second delete.
  expect(screen.queryByText(CONFIRM_QUESTION)).toBeNull();
  expect(mockDeleteAccount).toHaveBeenCalledTimes(1);

  release();
  await settle();
});

// Paper keeps the layout rules one layer above the painted surface; see
// docs/notes/app-component-testing-what-layout-can-be-asserted.md. The modal drops its dismiss
// handler while the delete is in flight, so a tap outside cannot close it over a running request.
it("cannot be dismissed by tapping outside while the delete is in flight", async () => {
  let release: () => void = () => {};
  mockDeleteAccount.mockReturnValue(new Promise<void>((resolve) => (release = resolve)));
  show();

  await reachConfirmation();
  await confirmDeletion();
  await flushUntil(() => screen.queryByText("Avslutar..."));

  fireEvent.press(screen.getByTestId("modal-backdrop"));
  await settle();

  expect(onDismiss).not.toHaveBeenCalled();

  release();
  await settle();
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

// A long validation message has to wrap inside the modal rather than widen it.
it("pins the validation message to the width of the field above it", async () => {
  show();

  type("kort");
  await send();

  const error = screen.getByTestId("delete-account-password-error");
  expect(error).toHaveTextContent("Lösenordet måste vara minst 8 tecken");
  expect(error).toHaveStyle({ width: WIDTH * 0.65 });
});
