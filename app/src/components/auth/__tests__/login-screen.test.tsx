// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import LoginScreen from "@/components/auth/login-screen";
import { BORDER_RADIUS } from "@/constants/constants";
import { AppDefaultTheme } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Dimensions } from "react-native";

const mockLogin = jest.fn();

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ login: mockLogin }),
}));

// The real module reaches Keycloak on import; only the error class matters here.
jest.mock("@/services/keycloak-auth", () => {
  class InvalidCredentialsError extends Error {}
  return { InvalidCredentialsError };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { InvalidCredentialsError } = require("@/services/keycloak-auth");

const WIDTH = Dimensions.get("screen").width;

function fillForm({ email = "vandrare@example.com", password = "hemligt123" } = {}) {
  fireEvent.changeText(screen.getByTestId("login-email"), email);
  fireEvent.changeText(screen.getByTestId("login-password"), password);
}

// Validation and the login call both resolve on microtasks, so they are flushed rather than waited for.
async function submit() {
  fireEvent.press(screen.getByTestId("login-submit"));
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLogin.mockResolvedValue(undefined);
});

it("logs in with what was typed", async () => {
  renderWithProviders(<LoginScreen />);

  fillForm();
  await submit();

  expect(mockLogin).toHaveBeenCalledWith("vandrare@example.com", "hemligt123");
});

// Each message lands under its own field, not merely somewhere on screen.
it("names the field each validation message belongs to", async () => {
  renderWithProviders(<LoginScreen />);

  await submit();

  expect(screen.getByTestId("login-email-error")).toHaveTextContent("Du måste ange en e-post");
  expect(screen.getByTestId("login-password-error")).toHaveTextContent("Ange ett lösenord");
  expect(mockLogin).not.toHaveBeenCalled();
});

it("rejects an address that is not one", async () => {
  renderWithProviders(<LoginScreen />);

  fillForm({ email: "vandrare-utan-snabel" });
  await submit();

  expect(screen.getByTestId("login-email-error")).toHaveTextContent("Ange en giltig e-post");
  expect(mockLogin).not.toHaveBeenCalled();
});

it("rejects a password shorter than eight characters", async () => {
  renderWithProviders(<LoginScreen />);

  fillForm({ password: "kort" });
  await submit();

  expect(screen.getByTestId("login-password-error")).toHaveTextContent("Lösenordet måste vara minst 8 tecken");
  expect(mockLogin).not.toHaveBeenCalled();
});

// Wrong credentials and a broken identity provider are different problems, and the message tells them apart.
it("tells a wrong password apart from a failing login service", async () => {
  mockLogin.mockRejectedValueOnce(new InvalidCredentialsError());
  renderWithProviders(<LoginScreen />);

  fillForm();
  await submit();
  expect(screen.getByTestId("login-error")).toHaveTextContent("Fel e-post eller lösenord.");

  mockLogin.mockRejectedValueOnce(new Error("504"));
  await submit();
  expect(screen.getByTestId("login-error")).toHaveTextContent("Inloggning misslyckades. Försök igen.");
});

it("clears the previous failure when the form is submitted again", async () => {
  mockLogin.mockRejectedValueOnce(new InvalidCredentialsError());
  renderWithProviders(<LoginScreen />);

  fillForm();
  await submit();
  expect(screen.getByTestId("login-error")).toBeTruthy();

  await submit();
  expect(mockLogin).toHaveBeenCalledTimes(2);
  expect(screen.queryByTestId("login-error")).toBeNull();
});

it("offers a back button only where the caller asked for one", () => {
  const { rerender } = renderWithProviders(<LoginScreen />);
  expect(screen.queryByTestId("icon-chevron-left")).toBeNull();

  rerender(<LoginScreen showBackButton />);
  expect(screen.getByTestId("icon-chevron-left")).toBeTruthy();
});

// The column is pinned to the field width, so a validation message wraps inside it.
it("keeps the error message inside the field column", async () => {
  renderWithProviders(<LoginScreen />);

  await submit();
  const message = screen.getByTestId("login-email-error");

  expect(message).toHaveStyle({
    color: AppDefaultTheme.colors.onErrorContainer,
    backgroundColor: AppDefaultTheme.colors.errorContainer,
    borderRadius: BORDER_RADIUS,
  });
});

it("sizes the card and its button against the screen width", () => {
  renderWithProviders(<LoginScreen />);

  expect(screen.getByTestId("login-field-column")).toHaveStyle({ width: WIDTH * 0.65 });
  // Paper's Surface splits the style: layout on the outer layer, colour and radius on the inner.
  expect(screen.getByTestId("login-submit-container-outer-layer")).toHaveStyle({ width: WIDTH * 0.5 });
  expect(screen.getByTestId("login-submit-container")).toHaveStyle({ borderRadius: BORDER_RADIUS });
});
