// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import VerifyEmailScreen from "../verify-email";

const mockVerify = jest.fn();
const mockResend = jest.fn();
const mockReplace = jest.fn();

let mockParams: { email?: string } = { email: "vandrare@example.com" };

jest.mock("@/api/auth", () => ({
  verifyEmailCode: (...args: unknown[]) => mockVerify(...args),
  resendVerification: (...args: unknown[]) => mockResend(...args),
}));

jest.mock("expo-router", () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  useLocalSearchParams: () => mockParams,
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockParams = { email: "vandrare@example.com" };
  mockVerify.mockResolvedValue(undefined);
  mockResend.mockResolvedValue(undefined);
});

function enterCode(code: string) {
  fireEvent.changeText(screen.getByTestId("verify-email-code"), code);
}

function submit() {
  fireEvent.press(screen.getByTestId("verify-email-submit"));
}

describe("entering the code", () => {
  it("sends the code together with the address it was registered for", async () => {
    renderWithProviders(<VerifyEmailScreen />);

    enterCode("123456");
    submit();

    await waitFor(() => expect(mockVerify).toHaveBeenCalledWith("vandrare@example.com", "123456"));
  });

  it("sends the user to login once the address is confirmed", async () => {
    renderWithProviders(<VerifyEmailScreen />);

    enterCode("123456");
    submit();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("./login"));
  });

  it.each(["12345", "1234567", "abcdef", ""])("refuses %p without calling the backend", async (code) => {
    renderWithProviders(<VerifyEmailScreen />);

    enterCode(code);
    submit();

    await screen.findByTestId("verify-email-code-error");
    expect(mockVerify).not.toHaveBeenCalled();
  });

  // Each backend code gets its own message: "wrong code" and "ask for a new mail" are
  // different instructions, and showing the first when the second is true strands the user.
  it.each([
    ["invalid-code", "Fel kod. Kontrollera mejlet och försök igen."],
    ["code-expired", "Koden har gått ut. Begär ett nytt mejl."],
    ["too-many-attempts", "För många försök. Begär ett nytt mejl."],
  ])("shows its own message for %s", async (code, message) => {
    mockVerify.mockRejectedValueOnce(new ApiError(code, 400));
    renderWithProviders(<VerifyEmailScreen />);

    enterCode("123456");
    submit();

    expect(await screen.findByTestId("verify-email-code-error")).toHaveTextContent(message);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe("resending the mail", () => {
  it("asks the backend for a new mail for the registered address", async () => {
    renderWithProviders(<VerifyEmailScreen />);

    fireEvent.press(screen.getByTestId("verify-email-resend"));

    await waitFor(() => expect(mockResend).toHaveBeenCalledWith("vandrare@example.com"));
  });

  // The backend ignores a resend inside its own cooldown, so a button that stayed pressable
  // would look broken: the user would tap it and no mail would arrive.
  it("goes quiet after a resend and will not send a second one", async () => {
    renderWithProviders(<VerifyEmailScreen />);

    fireEvent.press(screen.getByTestId("verify-email-resend"));
    await act(async () => {});

    expect(screen.getByTestId("verify-email-resend")).toBeDisabled();

    fireEvent.press(screen.getByTestId("verify-email-resend"));
    await act(async () => {});

    expect(mockResend).toHaveBeenCalledTimes(1);
  });
});

// Landing here without an address — a deep link, or a restored screen — must not produce a
// request with "undefined" in it.
describe("without a registered address", () => {
  beforeEach(() => {
    mockParams = {};
  });

  it("explains itself without naming an address", () => {
    renderWithProviders(<VerifyEmailScreen />);

    const intro = screen.getByTestId("verify-email-intro");

    expect(intro).toHaveTextContent(/mejl med en länk och en kod/);
    // The interpolated variant would render the literal "undefined" here.
    expect(intro).not.toHaveTextContent(/undefined/);
  });

  it("offers no resend", () => {
    renderWithProviders(<VerifyEmailScreen />);

    expect(screen.getByTestId("verify-email-resend")).toBeDisabled();
  });

  it("sends nothing when the form is submitted", async () => {
    renderWithProviders(<VerifyEmailScreen />);

    enterCode("123456");
    submit();
    await act(async () => {});

    expect(mockVerify).not.toHaveBeenCalled();
  });
});
