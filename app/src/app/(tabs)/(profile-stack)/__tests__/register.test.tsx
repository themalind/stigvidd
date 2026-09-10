// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import RegisterScreen from "../register";

const mockRegister = jest.fn();
const mockReplace = jest.fn();

// The real provider talks to Keycloak on import. The error type comes from the mock too, so the
// screen's instanceof check sees the class the test throws.
jest.mock("@/components/auth/auth-provider", () => {
  class RegisteredButLoginFailedError extends Error {}
  return {
    RegisteredButLoginFailedError,
    useAuth: () => ({ register: mockRegister }),
  };
});

jest.mock("expo-router", () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RegisteredButLoginFailedError } = require("@/components/auth/auth-provider");

beforeEach(() => {
  jest.clearAllMocks();
});

function fillForm({
  nickName = "stigvandraren",
  email = "vandrare@example.com",
  password = "hemligt123",
  confirmPassword = "hemligt123",
} = {}) {
  fireEvent.changeText(screen.getByTestId("register-nickname"), nickName);
  fireEvent.changeText(screen.getByTestId("register-email"), email);
  fireEvent.changeText(screen.getByTestId("register-password"), password);
  fireEvent.changeText(screen.getByTestId("register-confirm-password"), confirmPassword);
}

function submit() {
  fireEvent.press(screen.getByTestId("register-submit"));
}

// Each assertion names the container: a message rendered under the wrong field is still on screen.
async function errorUnder(field: "nickname" | "email" | "password" | "confirm-password") {
  return screen.findByTestId(`register-${field}-error`);
}

function noErrorUnder(field: "nickname" | "email" | "password" | "confirm-password") {
  expect(screen.queryByTestId(`register-${field}-error`)).toBeNull();
}

describe("validation errors", () => {
  it("shows one badge per empty field and does not call register", async () => {
    renderWithProviders(<RegisterScreen />);

    submit();

    expect(await errorUnder("nickname")).toHaveTextContent("Ange ett användarnamn");
    expect(screen.getByTestId("register-email-error")).toHaveTextContent("Du måste ange en e-post");
    expect(screen.getByTestId("register-password-error")).toHaveTextContent("Ange ett lösenord");
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("rejects an address that is not an email", async () => {
    renderWithProviders(<RegisterScreen />);

    fillForm({ email: "vandrare@" });
    submit();

    expect(await errorUnder("email")).toHaveTextContent("Ange en giltig e-post");
    noErrorUnder("nickname");
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("rejects a nickname with characters the backend will not accept", async () => {
    renderWithProviders(<RegisterScreen />);

    fillForm({ nickName: "stig vandraren!" });
    submit();

    expect(await errorUnder("nickname")).toHaveTextContent("Endast a–z, 0–9, _ och - är tillåtna");
    noErrorUnder("email");
  });

  it("reports the mismatch on the repeat field, not the password field", async () => {
    renderWithProviders(<RegisterScreen />);

    fillForm({ password: "hemligt123", confirmPassword: "hemligt124" });
    submit();

    expect(await errorUnder("confirm-password")).toHaveTextContent("Lösenorden matchar inte");
    noErrorUnder("password");
  });

  it("submits the typed values once every field is valid", async () => {
    renderWithProviders(<RegisterScreen />);

    fillForm();
    submit();

    await waitFor(() =>
      expect(mockRegister).toHaveBeenCalledWith({
        nickName: "stigvandraren",
        email: "vandrare@example.com",
        password: "hemligt123",
        confirmPassword: "hemligt123",
      }),
    );
  });
});

// A 409 lands on the field that collided, with the message string the API sends.
describe("conflicts reported by the backend", () => {
  it("puts a taken nickname on the nickname field", async () => {
    mockRegister.mockRejectedValueOnce(new ApiError("nickname-taken", 409));
    renderWithProviders(<RegisterScreen />);

    fillForm();
    submit();

    expect(await errorUnder("nickname")).toHaveTextContent("Smeknamnet upptaget!");
    noErrorUnder("email");
    expect(screen.queryByText("Ett oväntat fel inträffade")).toBeNull();
  });

  it("puts a taken email on the email field", async () => {
    mockRegister.mockRejectedValueOnce(new ApiError("email-taken", 409));
    renderWithProviders(<RegisterScreen />);

    fillForm();
    submit();

    expect(await errorUnder("email")).toHaveTextContent("E-postadressen är redan registrerad!");
    noErrorUnder("nickname");
  });

  it("sends the user to login when the account was created but auto-login failed", async () => {
    mockRegister.mockRejectedValueOnce(new RegisteredButLoginFailedError());
    renderWithProviders(<RegisterScreen />);

    fillForm();
    submit();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("./login"));
    expect(screen.queryByText("Ett oväntat fel inträffade")).toBeNull();
  });

  it("falls back to the generic message for an error it cannot place", async () => {
    mockRegister.mockRejectedValueOnce(new Error("socket hang up"));
    renderWithProviders(<RegisterScreen />);

    fillForm();
    submit();

    expect(await screen.findByText("Ett oväntat fel inträffade")).toBeTruthy();
    noErrorUnder("nickname");
    noErrorUnder("email");
  });
});
