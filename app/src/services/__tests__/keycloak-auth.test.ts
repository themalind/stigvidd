jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("jwt-decode", () => ({ jwtDecode: jest.fn() }));

import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import type * as KeycloakAuthModule from "../keycloak-auth";

// The module reads these at load time, so they must be set before the require below.
process.env.EXPO_PUBLIC_OIDC_URL = "https://kc.test/auth";
process.env.EXPO_PUBLIC_OIDC_REALM = "stigvidd";
process.env.EXPO_PUBLIC_CLIENT_ID = "stigvidd-app";

// require (not a hoisted import) so the SUT loads AFTER the env vars above are set.
const {
  decodeUser,
  passwordGrant,
  refreshGrant,
  logoutKeycloak,
  getValidAccessToken,
  restoreSession,
  loadTokens,
  clearTokens,
  setSessionExpiredHandler,
  InvalidCredentialsError,
} = require("../keycloak-auth") as typeof KeycloakAuthModule;

const TOKEN_ENDPOINT = "https://kc.test/auth/realms/stigvidd/protocol/openid-connect/token";
const LOGOUT_ENDPOINT = "https://kc.test/auth/realms/stigvidd/protocol/openid-connect/logout";

const STORAGE_KEYS = {
  accessToken: "kc_access_token",
  refreshToken: "kc_refresh_token",
  accessExpiresAt: "kc_access_expires_at",
};

const mockSetItem = SecureStore.setItemAsync as jest.Mock;
const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockDeleteItem = SecureStore.deleteItemAsync as jest.Mock;
const mockJwtDecode = jwtDecode as jest.Mock;

const tokenResponse = {
  access_token: "access-1",
  refresh_token: "refresh-1",
  expires_in: 300,
  refresh_expires_in: 1800,
  token_type: "Bearer",
  id_token: "id-1",
};

function mockFetch(status: number, body: unknown = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response);
}

/** Load known tokens into the module's in-memory cache via loadTokens(). */
function seedTokens(accessExpiresAtMs: number) {
  mockGetItem.mockImplementation((key: string) => {
    switch (key) {
      case STORAGE_KEYS.accessToken:
        return Promise.resolve("access-1");
      case STORAGE_KEYS.refreshToken:
        return Promise.resolve("refresh-1");
      case STORAGE_KEYS.accessExpiresAt:
        return Promise.resolve(String(accessExpiresAtMs));
      default:
        return Promise.resolve(null);
    }
  });
  return loadTokens();
}

const NOW_MS = 1_000_000_000_000;
const NOW_S = Math.floor(NOW_MS / 1000);

beforeEach(async () => {
  await clearTokens(); // reset the module's in-memory token state between tests
  jest.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockJwtDecode.mockReturnValue({ sub: "user-1", email: "alice@example.com", preferred_username: "alice" });
  setSessionExpiredHandler(null);
});

afterEach(() => {
  jest.restoreAllMocks(); // restore any Date.now spies
});

describe("decodeUser", () => {
  it("maps Keycloak claims to the AuthUser shape", () => {
    mockJwtDecode.mockReturnValue({ sub: "user-1", email: "alice@example.com", preferred_username: "alice" });
    expect(decodeUser("token")).toEqual({ id: "user-1", email: "alice@example.com", username: "alice" });
  });

  it("falls back to name when preferred_username is missing", () => {
    mockJwtDecode.mockReturnValue({ sub: "user-1", email: "a@b.se", name: "Alice A" });
    expect(decodeUser("token").username).toBe("Alice A");
  });

  it("uses empty strings when email and username claims are absent", () => {
    mockJwtDecode.mockReturnValue({ sub: "user-1" });
    expect(decodeUser("token")).toEqual({ id: "user-1", email: "", username: "" });
  });
});

describe("passwordGrant", () => {
  it("POSTs the password grant to the token endpoint", async () => {
    mockFetch(200, tokenResponse);
    await passwordGrant("alice@example.com", "password123");

    const [url, options] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(TOKEN_ENDPOINT);
    expect(options.method).toBe("POST");
    const body = options.body as string;
    expect(body).toContain("grant_type=password");
    expect(body).toContain("client_id=stigvidd-app");
    expect(body).toContain("username=alice%40example.com");
    expect(body).toContain("password=password123");
  });

  it("requests the offline_access scope so the refresh token survives long-term", async () => {
    mockFetch(200, tokenResponse);
    await passwordGrant("alice@example.com", "password123");

    const body = (fetch as jest.Mock).mock.calls[0][1].body as string;
    expect(body).toContain("offline_access");
  });

  it("persists all three tokens and returns the decoded user", async () => {
    mockFetch(200, tokenResponse);
    const user = await passwordGrant("alice@example.com", "password123");

    expect(mockSetItem).toHaveBeenCalledWith(STORAGE_KEYS.accessToken, "access-1");
    expect(mockSetItem).toHaveBeenCalledWith(STORAGE_KEYS.refreshToken, "refresh-1");
    expect(mockSetItem).toHaveBeenCalledWith(STORAGE_KEYS.accessExpiresAt, expect.any(String));
    expect(user).toEqual({ id: "user-1", email: "alice@example.com", username: "alice" });
  });

  it("decodes the id_token in preference to the access_token", async () => {
    mockFetch(200, tokenResponse);
    await passwordGrant("alice@example.com", "password123");
    expect(mockJwtDecode).toHaveBeenCalledWith("id-1");
  });

  it("falls back to the access_token when no id_token is returned", async () => {
    const { id_token, ...withoutIdToken } = tokenResponse;
    mockFetch(200, withoutIdToken);
    await passwordGrant("alice@example.com", "password123");
    expect(mockJwtDecode).toHaveBeenCalledWith("access-1");
  });

  it("throws InvalidCredentialsError on 401", async () => {
    mockFetch(401);
    await expect(passwordGrant("alice@example.com", "wrong")).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("throws InvalidCredentialsError on 400", async () => {
    mockFetch(400);
    await expect(passwordGrant("alice@example.com", "wrong")).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("throws a generic error (not InvalidCredentialsError) on 500", async () => {
    mockFetch(500);
    await expect(passwordGrant("alice@example.com", "password123")).rejects.not.toBeInstanceOf(InvalidCredentialsError);
  });
});

describe("refreshGrant", () => {
  it("persists fresh tokens and returns the user on success", async () => {
    mockFetch(200, tokenResponse);
    const user = await refreshGrant("refresh-1");
    expect(user).toEqual({ id: "user-1", email: "alice@example.com", username: "alice" });
    expect(mockSetItem).toHaveBeenCalledWith(STORAGE_KEYS.accessToken, "access-1");
  });

  it("clears tokens and returns null when the refresh token is rejected (invalid_grant)", async () => {
    mockFetch(400);
    const user = await refreshGrant("expired-refresh");
    expect(user).toBeNull();
    expect(mockDeleteItem).toHaveBeenCalledWith(STORAGE_KEYS.refreshToken);
  });

  it("invokes the registered session-expired handler when the refresh token is rejected", async () => {
    const handler = jest.fn();
    setSessionExpiredHandler(handler);
    mockFetch(400);
    await refreshGrant("expired-refresh");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("preserves tokens and does not end the session on a transient 5xx failure", async () => {
    const handler = jest.fn();
    setSessionExpiredHandler(handler);
    mockFetch(503);
    const user = await refreshGrant("refresh-1");
    expect(user).toBeNull();
    expect(handler).not.toHaveBeenCalled();
    expect(mockDeleteItem).not.toHaveBeenCalled();
  });

  it("preserves tokens and does not end the session on a network error", async () => {
    const handler = jest.fn();
    setSessionExpiredHandler(handler);
    global.fetch = jest.fn().mockRejectedValue(new Error("network down"));
    const user = await refreshGrant("refresh-1");
    expect(user).toBeNull();
    expect(handler).not.toHaveBeenCalled();
    expect(mockDeleteItem).not.toHaveBeenCalled();
  });

  it("does not invoke the handler after it has been cleared", async () => {
    const handler = jest.fn();
    setSessionExpiredHandler(handler);
    setSessionExpiredHandler(null);
    mockFetch(400);
    await refreshGrant("expired-refresh");
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("logoutKeycloak", () => {
  it("revokes the session at Keycloak and clears tokens when a refresh token exists", async () => {
    await seedTokens((NOW_S + 300) * 1000);
    mockFetch(204);
    await logoutKeycloak();

    const [url, options] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(LOGOUT_ENDPOINT);
    expect(options.body as string).toContain("refresh_token=refresh-1");
    expect(mockDeleteItem).toHaveBeenCalledWith(STORAGE_KEYS.refreshToken);
  });

  it("skips the network revocation but still clears tokens when there is no refresh token", async () => {
    global.fetch = jest.fn();
    await logoutKeycloak();
    expect(fetch).not.toHaveBeenCalled();
    expect(mockDeleteItem).toHaveBeenCalledWith(STORAGE_KEYS.accessToken);
  });

  it("clears tokens even when the revocation request throws", async () => {
    await seedTokens((NOW_S + 300) * 1000);
    global.fetch = jest.fn().mockRejectedValue(new Error("network down"));
    await expect(logoutKeycloak()).resolves.toBeUndefined();
    expect(mockDeleteItem).toHaveBeenCalledWith(STORAGE_KEYS.refreshToken);
  });
});

describe("getValidAccessToken", () => {
  it("returns null when there are no tokens", async () => {
    expect(await getValidAccessToken()).toBeNull();
  });

  it("returns the cached access token while it is still valid", async () => {
    jest.spyOn(Date, "now").mockReturnValue(NOW_MS);
    await seedTokens((NOW_S + 300) * 1000); // expires well beyond the skew window
    global.fetch = jest.fn();

    expect(await getValidAccessToken()).toBe("access-1");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refreshes and returns a new token when the access token has expired", async () => {
    jest.spyOn(Date, "now").mockReturnValue(NOW_MS);
    await seedTokens((NOW_S - 10) * 1000); // already expired
    mockFetch(200, { ...tokenResponse, access_token: "access-2" });

    expect(await getValidAccessToken()).toBe("access-2");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("shares a single in-flight refresh between concurrent callers", async () => {
    jest.spyOn(Date, "now").mockReturnValue(NOW_MS);
    await seedTokens((NOW_S - 10) * 1000); // already expired
    mockFetch(200, { ...tokenResponse, access_token: "access-2" });

    const [a, b] = await Promise.all([getValidAccessToken(), getValidAccessToken()]);
    expect(a).toBe("access-2");
    expect(b).toBe("access-2");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("restoreSession", () => {
  it("returns null when there are no stored tokens", async () => {
    mockGetItem.mockResolvedValue(null);
    global.fetch = jest.fn();
    expect(await restoreSession()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns the user from a still-valid stored access token without refreshing", async () => {
    jest.spyOn(Date, "now").mockReturnValue(NOW_MS);
    await seedTokens((NOW_S + 300) * 1000); // valid well beyond the skew window
    global.fetch = jest.fn();

    const user = await restoreSession();
    expect(user).toEqual({ id: "user-1", email: "alice@example.com", username: "alice" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refreshes once through the single-flight path when the stored access token is expired", async () => {
    jest.spyOn(Date, "now").mockReturnValue(NOW_MS);
    await seedTokens((NOW_S - 10) * 1000); // expired
    mockFetch(200, { ...tokenResponse, access_token: "access-2" });

    const user = await restoreSession();
    expect(user).toEqual({ id: "user-1", email: "alice@example.com", username: "alice" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("loadTokens / clearTokens", () => {
  it("loadTokens returns the stored refresh token", async () => {
    const { refreshToken } = await seedTokens((NOW_S + 300) * 1000);
    expect(refreshToken).toBe("refresh-1");
  });

  it("clearTokens deletes all three stored keys", async () => {
    await clearTokens();
    expect(mockDeleteItem).toHaveBeenCalledWith(STORAGE_KEYS.accessToken);
    expect(mockDeleteItem).toHaveBeenCalledWith(STORAGE_KEYS.refreshToken);
    expect(mockDeleteItem).toHaveBeenCalledWith(STORAGE_KEYS.accessExpiresAt);
  });
});
