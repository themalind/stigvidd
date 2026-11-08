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

// The real provider talks to Keycloak on import.
jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ register: mockRegister }),
}));

jest.mock("expo-router", () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

async function fillForm({
  nickName = "stigvandraren",
  email = "vandrare@example.com",
  password = "hemligt123",
  confirmPassword = "hemligt123",
} = {}) {
  await fireEvent.changeText(screen.getByTestId("register-nickname"), nickName);
  await fireEvent.changeText(screen.getByTestId("register-email"), email);
  await fireEvent.changeText(screen.getByTestId("register-password"), password);
  await fireEvent.changeText(screen.getByTestId("register-confirm-password"), confirmPassword);
}

async function submit() {
  await fireEvent.press(screen.getByTestId("register-submit"));
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
    await renderWithProviders(<RegisterScreen />);

    await submit();

    expect(await errorUnder("nickname")).toHaveTextContent("Ange ett användarnamn");
    expect(screen.getByTestId("register-email-error")).toHaveTextContent("Du måste ange en e-post");
    expect(screen.getByTestId("register-password-error")).toHaveTextContent("Ange ett lösenord");
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("rejects an address that is not an email", async () => {
    await renderWithProviders(<RegisterScreen />);

    await fillForm({ email: "vandrare@" });
    await submit();

    expect(await errorUnder("email")).toHaveTextContent("Ange en giltig e-post");
    noErrorUnder("nickname");
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("rejects a one-character nickname", async () => {
    await renderWithProviders(<RegisterScreen />);

    await fillForm({ nickName: "B" });
    await submit();

    expect(await errorUnder("nickname")).toHaveTextContent("Namn för kort. Minst 2 tecken");
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("rejects a nickname with spaces or punctuation", async () => {
    await renderWithProviders(<RegisterScreen />);

    await fillForm({ nickName: "stig vandraren!" });
    await submit();

    expect(await errorUnder("nickname")).toHaveTextContent("Endast a–ö, 0–9, _ och - är tillåtna");
    noErrorUnder("email");
  });

  it("accepts å, ä and ö in a nickname", async () => {
    await renderWithProviders(<RegisterScreen />);

    await fillForm({ nickName: "Skogsälvan_Åsa-Ö" });
    await submit();

    await waitFor(() =>
      expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({ nickName: "Skogsälvan_Åsa-Ö" })),
    );
    noErrorUnder("nickname");
  });

  it("accepts a nickname and address the keyboard left a space after, and sends them without it", async () => {
    await renderWithProviders(<RegisterScreen />);

    await fillForm({ nickName: "Skogsälvan ", email: " vandrare@example.com " });
    await submit();

    await waitFor(() =>
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({ nickName: "Skogsälvan", email: "vandrare@example.com" }),
      ),
    );
    noErrorUnder("nickname");
  });

  it("keeps the keyboard from suggesting words, and the space it adds after one, in the nickname and address", async () => {
    await renderWithProviders(<RegisterScreen />);

    for (const field of ["register-nickname", "register-email"]) {
      expect(screen.getByTestId(field)).toHaveProp("autoCorrect", false);
    }
    expect(screen.getByTestId("register-nickname")).toHaveProp("spellCheck", false);
  });

  it("reports the mismatch on the repeat field, not the password field", async () => {
    await renderWithProviders(<RegisterScreen />);

    await fillForm({ password: "hemligt123", confirmPassword: "hemligt124" });
    await submit();

    expect(await errorUnder("confirm-password")).toHaveTextContent("Lösenorden matchar inte");
    noErrorUnder("password");
  });

  it("submits the typed values once every field is valid", async () => {
    await renderWithProviders(<RegisterScreen />);

    await fillForm();
    await submit();

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
    await renderWithProviders(<RegisterScreen />);

    await fillForm();
    await submit();

    expect(await errorUnder("nickname")).toHaveTextContent("Smeknamnet upptaget!");
    noErrorUnder("email");
    expect(screen.queryByText("Ett oväntat fel inträffade")).toBeNull();
  });

  it("puts a taken email on the email field", async () => {
    mockRegister.mockRejectedValueOnce(new ApiError("email-taken", 409));
    await renderWithProviders(<RegisterScreen />);

    await fillForm();
    await submit();

    expect(await errorUnder("email")).toHaveTextContent("E-postadressen är redan registrerad!");
    noErrorUnder("nickname");
  });

  // The account is created disabled, so there is no session to land in — the user goes to the
  // verification step, carrying the address they just typed.
  it("sends the user to the verification screen with the address they registered", async () => {
    await renderWithProviders(<RegisterScreen />);

    await fillForm({ email: "vandrare@example.com" });
    await submit();

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: "./verify-email",
        params: { email: "vandrare@example.com" },
      }),
    );
    expect(screen.queryByText("Ett oväntat fel inträffade")).toBeNull();
  });

  it("falls back to the generic message for an error it cannot place", async () => {
    mockRegister.mockRejectedValueOnce(new Error("socket hang up"));
    await renderWithProviders(<RegisterScreen />);

    await fillForm();
    await submit();

    expect(await screen.findByText("Ett oväntat fel inträffade")).toBeTruthy();
    noErrorUnder("nickname");
    noErrorUnder("email");
    // A registration that failed leaves nothing to verify, so nobody is sent onward.
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
