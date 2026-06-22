jest.mock("@/api/api-config", () => ({ BASE_URL: "http://test/api/v1" }));

jest.mock("@/i18n", () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

import { ApiError } from "../api-error";
import { registerAccount, userPasswordReset } from "../auth";
import { RegisterData } from "@/data/types";

function mockFetch(status: number, body: unknown = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
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

  it("throws ApiError 'nickname-taken' on 409", async () => {
    mockFetch(409);
    await expect(registerAccount(registerData)).rejects.toMatchObject({
      message: "nickname-taken",
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
