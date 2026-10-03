// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

jest.mock("@/api/api-config", () => ({
  ...jest.requireActual("@/api/api-config"),
  BASE_URL: "http://test/api/v1",
}));

jest.mock("@/i18n", () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

jest.mock("@/services/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import { ApiError } from "../api-error";
import { registerAccount, resendVerification, userPasswordReset, verifyEmailCode } from "../auth";
import { RegisterData } from "@/data/types";
import { logger } from "@/services/logger";

const mockLoggerError = logger.error as jest.Mock;

function mockFetch(status: number, body: unknown = {}, text = "") {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(text),
  } as unknown as Response);
}

const registerData: RegisterData = {
  nickName: "alice",
  email: "alice@example.com",
  password: "password123",
  confirmPassword: "password123",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("registerAccount", () => {
  it("POSTs the account payload to /account/register", async () => {
    mockFetch(200);
    await registerAccount(registerData);
    expect(fetch).toHaveBeenCalledWith(
      "http://test/api/v1/account/register",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registerData.email,
          nickName: registerData.nickName,
          password: registerData.password,
        }),
      }),
    );
  });

  it("does not send confirmPassword to the backend", async () => {
    mockFetch(200);
    await registerAccount(registerData);
    const body = (fetch as jest.Mock).mock.calls[0][1].body as string;
    expect(body).not.toContain("confirmPassword");
  });

  it("resolves without throwing on success", async () => {
    mockFetch(200);
    await expect(registerAccount(registerData)).resolves.toBeUndefined();
  });

  it("throws ApiError 'nickname-taken' when the 409 body says the nickname collided", async () => {
    mockFetch(409, {}, "nickname-taken");
    await expect(registerAccount(registerData)).rejects.toMatchObject({
      message: "nickname-taken",
      status: 409,
    });
  });

  it("throws ApiError 'email-taken' when the 409 body says the email collided", async () => {
    mockFetch(409, {}, "email-taken");
    await expect(registerAccount(registerData)).rejects.toMatchObject({
      message: "email-taken",
      status: 409,
    });
  });

  it("tolerates a JSON-quoted conflict code", async () => {
    mockFetch(409, {}, '"email-taken"');
    await expect(registerAccount(registerData)).rejects.toMatchObject({ message: "email-taken" });
  });

  it("blames no field when the 409 body is not a known code", async () => {
    mockFetch(409, {}, "A user with that email already exists.");
    await expect(registerAccount(registerData)).rejects.toMatchObject({
      message: "registration-conflict",
      status: 409,
    });
  });

  it("throws ApiError with the status on other error responses", async () => {
    mockFetch(500);
    await expect(registerAccount(registerData)).rejects.toBeInstanceOf(ApiError);
    mockFetch(500);
    await expect(registerAccount(registerData)).rejects.toMatchObject({ status: 500 });
  });
});

describe("verifyEmailCode", () => {
  it("POSTs the address and code to /account/verify-email", async () => {
    mockFetch(204);

    await verifyEmailCode("alice@example.com", "123456");

    expect(fetch).toHaveBeenCalledWith(
      "http://test/api/v1/account/verify-email",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "alice@example.com", code: "123456" }),
      }),
    );
  });

  it("sends no bearer token — the account is disabled until this succeeds", async () => {
    mockFetch(204);

    await verifyEmailCode("alice@example.com", "123456");

    const init = (fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  // The screen puts each of these under the code field as its own message, so the code has to
  // survive the trip rather than collapsing into a generic failure.
  it.each(["invalid-code", "code-expired", "too-many-attempts"])("surfaces the %s code from the body", async (code) => {
    mockFetch(400, {}, `"${code}"`);

    await expect(verifyEmailCode("alice@example.com", "000000")).rejects.toMatchObject({ message: code });
  });

  it("falls back to a generic code for a body it does not recognise", async () => {
    mockFetch(500, {}, "<html>gateway</html>");

    await expect(verifyEmailCode("alice@example.com", "123456")).rejects.toMatchObject({
      message: "verification-failed",
    });
  });

  it("resolves without throwing on success", async () => {
    mockFetch(204);

    await expect(verifyEmailCode("alice@example.com", "123456")).resolves.toBeUndefined();
  });
});

describe("resendVerification", () => {
  it("POSTs the address to /account/resend-verification", async () => {
    mockFetch(204);

    await resendVerification("alice@example.com");

    expect(fetch).toHaveBeenCalledWith(
      "http://test/api/v1/account/resend-verification",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "alice@example.com" }),
      }),
    );
  });

  // The backend answers 204 whether or not the address exists, so this resolving says nothing
  // about the address — which is the point.
  it("resolves for an address the backend says nothing about", async () => {
    mockFetch(204);

    await expect(resendVerification("nobody@example.com")).resolves.toBeUndefined();
  });

  it("throws an ApiError when the request itself fails", async () => {
    mockFetch(500);

    await expect(resendVerification("alice@example.com")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("userPasswordReset", () => {
  it("POSTs the email to /account/forgot-password", async () => {
    mockFetch(200);
    await userPasswordReset("alice@example.com");
    expect(fetch).toHaveBeenCalledWith(
      "http://test/api/v1/account/forgot-password",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@example.com" }),
      }),
    );
  });

  it("returns success when the backend responds 2xx", async () => {
    mockFetch(200);
    const result = await userPasswordReset("alice@example.com");
    expect(result).toEqual({ success: true, error: null });
  });

  it("returns a failure result (never throws) on an error response", async () => {
    mockFetch(500);
    const result = await userPasswordReset("alice@example.com");
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("unknown");
  });

  it("returns a failure result (never throws) on a network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down"));
    const result = await userPasswordReset("alice@example.com");
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe("network down");
  });
});

describe("failure logging", () => {
  // These run before the user has a session, so the address and password are all that identify them.
  it.each([
    ["registerAccount", () => registerAccount(registerData), "Register account failed", "POST /account/register"],
    [
      "verifyEmailCode",
      () => verifyEmailCode("alice@example.com", "123456"),
      "Verify email code failed",
      "POST /account/verify-email",
    ],
    [
      "resendVerification",
      () => resendVerification("alice@example.com"),
      "Resend verification failed",
      "POST /account/resend-verification",
    ],
    [
      "userPasswordReset",
      () => userPasswordReset("alice@example.com"),
      "Password reset request failed",
      "POST /account/forgot-password",
    ],
  ])("%s logs the endpoint and cause, but not what was typed", async (_name, call, message, endpoint) => {
    mockFetch(500);

    await call().catch(() => undefined);

    expect(mockLoggerError).toHaveBeenCalledWith(message, { endpoint, errorMessage: expect.any(String) });
    const logged = JSON.stringify(mockLoggerError.mock.calls);
    expect(logged).not.toContain("alice@example.com");
    expect(logged).not.toContain("password123");
    expect(logged).not.toContain("123456");
  });

  it("logs nothing when the call succeeds", async () => {
    mockFetch(204);

    await registerAccount(registerData);

    expect(mockLoggerError).not.toHaveBeenCalled();
  });
});
