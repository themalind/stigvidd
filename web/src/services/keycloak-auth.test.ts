import { beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN_ENDPOINT =
  "https://oidc.test/realms/test-realm/protocol/openid-connect/token";
const LOGOUT_ENDPOINT =
  "https://oidc.test/realms/test-realm/protocol/openid-connect/logout";
const REFRESH_TOKEN_KEY = "kc_refresh_token";

/** A structurally real JWT — jwt-decode reads the middle segment and ignores the rest. */
function jwt(claims: Record<string, unknown>): string {
  const segment = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  return `${segment({ alg: "none", typ: "JWT" })}.${segment(claims)}.signature`;
}

const adminToken = jwt({
  sub: "user-1",
  realm_access: { roles: ["default-roles-stigvidd", "stigvidd-admin"] },
});
const nonAdminToken = jwt({ sub: "user-2", realm_access: { roles: ["hiker"] } });
const idToken = jwt({
  sub: "user-1",
  email: "admin@example.test",
  preferred_username: "admin",
});

function tokenResponse(overrides: Record<string, unknown> = {}) {
  return {
    access_token: adminToken,
    refresh_token: "refresh-1",
    expires_in: 300,
    refresh_expires_in: 2_592_000,
    token_type: "Bearer",
    id_token: idToken,
    ...overrides,
  };
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

/**
 * The module keeps the access token, its expiry and the refresh token in module
 * scope, so every test needs its own copy — otherwise a token minted in one test
 * is the cache hit in the next.
 */
async function loadAuth() {
  vi.resetModules();
  return import("./keycloak-auth");
}

function formBody(call: number): URLSearchParams {
  const [, init] = vi.mocked(fetch).mock.calls[call] as [string, RequestInit];

  return new URLSearchParams(init.body as string);
}

describe("keycloak-auth", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(tokenResponse())));
  });

  describe("passwordGrant", () => {
    it("posts a Direct Access Grant to the realm's token endpoint", async () => {
      const { passwordGrant } = await loadAuth();

      await passwordGrant("admin@example.test", "hunter2");

      const [url, init] = vi.mocked(fetch).mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(url).toBe(TOKEN_ENDPOINT);
      expect(init.method).toBe("POST");
      expect(Object.fromEntries(formBody(0))).toEqual({
        grant_type: "password",
        client_id: "test-client",
        username: "admin@example.test",
        password: "hunter2",
        scope: "openid profile email offline_access",
      });
    });

    it("returns the identity from the id_token", async () => {
      const { passwordGrant } = await loadAuth();

      await expect(
        passwordGrant("admin@example.test", "hunter2"),
      ).resolves.toEqual({
        id: "user-1",
        email: "admin@example.test",
        username: "admin",
      });
    });

    it("persists the refresh token so the session survives a reload", async () => {
      const { passwordGrant } = await loadAuth();

      await passwordGrant("admin@example.test", "hunter2");

      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("refresh-1");
    });

    it("rejects a user without the admin realm role, and stores nothing", async () => {
      vi.mocked(fetch).mockResolvedValue(
        ok(tokenResponse({ access_token: nonAdminToken })),
      );
      const { passwordGrant, NotAuthorizedError } = await loadAuth();

      await expect(
        passwordGrant("hiker@example.test", "hunter2"),
      ).rejects.toBeInstanceOf(NotAuthorizedError);
      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    });

    it("rejects a token with no realm_access claim at all", async () => {
      vi.mocked(fetch).mockResolvedValue(
        ok(tokenResponse({ access_token: jwt({ sub: "user-3" }) })),
      );
      const { passwordGrant, NotAuthorizedError } = await loadAuth();

      await expect(passwordGrant("x@example.test", "y")).rejects.toBeInstanceOf(
        NotAuthorizedError,
      );
    });

    it("turns Keycloak's 401 into InvalidCredentialsError", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("", { status: 401 }));
      const { passwordGrant, InvalidCredentialsError } = await loadAuth();

      await expect(
        passwordGrant("admin@example.test", "wrong"),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });

    it("turns Keycloak's 400 into InvalidCredentialsError", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("", { status: 400 }));
      const { passwordGrant, InvalidCredentialsError } = await loadAuth();

      await expect(
        passwordGrant("admin@example.test", "wrong"),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });

    it("does not disguise a 500 as bad credentials", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("", { status: 500 }));
      const { passwordGrant, InvalidCredentialsError } = await loadAuth();

      const error = await passwordGrant("a", "b").catch((e: Error) => e);

      expect(error).not.toBeInstanceOf(InvalidCredentialsError);
      expect((error as Error).message).toContain("HTTP 500");
    });
  });

  describe("refreshGrant", () => {
    it("exchanges the refresh token and returns the user", async () => {
      const { refreshGrant } = await loadAuth();

      await expect(refreshGrant("refresh-0")).resolves.toEqual({
        id: "user-1",
        email: "admin@example.test",
        username: "admin",
      });
      expect(Object.fromEntries(formBody(0))).toEqual({
        grant_type: "refresh_token",
        client_id: "test-client",
        refresh_token: "refresh-0",
      });
    });

    it("ends the session when the refresh token is genuinely rejected", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("", { status: 400 }));
      const { refreshGrant, setSessionExpiredHandler } = await loadAuth();
      const expired = vi.fn();
      setSessionExpiredHandler(expired);
      localStorage.setItem(REFRESH_TOKEN_KEY, "refresh-0");

      await expect(refreshGrant("refresh-0")).resolves.toBeNull();

      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
      expect(expired).toHaveBeenCalledOnce();
    });

    // The distinction refreshGrant's comment is about: a network blip must not log
    // the admin out, because the stored token is still good.
    it("keeps the stored token on a transient failure", async () => {
      vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));
      const { refreshGrant, setSessionExpiredHandler } = await loadAuth();
      const expired = vi.fn();
      setSessionExpiredHandler(expired);
      localStorage.setItem(REFRESH_TOKEN_KEY, "refresh-0");

      await expect(refreshGrant("refresh-0")).resolves.toBeNull();

      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("refresh-0");
      expect(expired).not.toHaveBeenCalled();
    });

    it("keeps the stored token on a 5xx", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("", { status: 503 }));
      const { refreshGrant } = await loadAuth();
      localStorage.setItem(REFRESH_TOKEN_KEY, "refresh-0");

      await expect(refreshGrant("refresh-0")).resolves.toBeNull();

      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("refresh-0");
    });

    it("ends the session when the role has been revoked since login", async () => {
      vi.mocked(fetch).mockResolvedValue(
        ok(tokenResponse({ access_token: nonAdminToken })),
      );
      const { refreshGrant, setSessionExpiredHandler } = await loadAuth();
      const expired = vi.fn();
      setSessionExpiredHandler(expired);
      localStorage.setItem(REFRESH_TOKEN_KEY, "refresh-0");

      await expect(refreshGrant("refresh-0")).resolves.toBeNull();

      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
      expect(expired).toHaveBeenCalledOnce();
    });
  });

  describe("restoreSession", () => {
    it("returns null and asks Keycloak nothing when no token is stored", async () => {
      const { restoreSession } = await loadAuth();

      await expect(restoreSession()).resolves.toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it("exchanges the persisted refresh token on start-up", async () => {
      localStorage.setItem(REFRESH_TOKEN_KEY, "refresh-stored");
      const { restoreSession } = await loadAuth();

      await expect(restoreSession()).resolves.toMatchObject({ id: "user-1" });
      expect(formBody(0).get("refresh_token")).toBe("refresh-stored");
    });
  });

  describe("getValidAccessToken", () => {
    it("returns null when there is no session", async () => {
      const { getValidAccessToken } = await loadAuth();

      await expect(getValidAccessToken()).resolves.toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it("serves a live token from memory without touching the network", async () => {
      const { passwordGrant, getValidAccessToken } = await loadAuth();
      await passwordGrant("admin@example.test", "hunter2");
      vi.mocked(fetch).mockClear();

      await expect(getValidAccessToken()).resolves.toBe(adminToken);
      expect(fetch).not.toHaveBeenCalled();
    });

    // EXPIRY_SKEW_SECONDS is 30, so a token with 10s left is already stale.
    it("refreshes a token that is inside the expiry skew", async () => {
      vi.mocked(fetch).mockResolvedValue(ok(tokenResponse({ expires_in: 10 })));
      const { passwordGrant, getValidAccessToken } = await loadAuth();
      await passwordGrant("admin@example.test", "hunter2");
      vi.mocked(fetch).mockClear();

      await getValidAccessToken();

      expect(fetch).toHaveBeenCalledOnce();
      expect(formBody(0).get("grant_type")).toBe("refresh_token");
    });

    it("shares one refresh between concurrent callers", async () => {
      vi.mocked(fetch).mockResolvedValue(ok(tokenResponse({ expires_in: 0 })));
      const { passwordGrant, getValidAccessToken } = await loadAuth();
      await passwordGrant("admin@example.test", "hunter2");
      vi.mocked(fetch).mockClear();

      const tokens = await Promise.all([
        getValidAccessToken(),
        getValidAccessToken(),
        getValidAccessToken(),
      ]);

      expect(fetch).toHaveBeenCalledOnce();
      expect(tokens).toEqual([adminToken, adminToken, adminToken]);
    });

    it("refreshes again after the shared refresh has settled", async () => {
      vi.mocked(fetch).mockResolvedValue(ok(tokenResponse({ expires_in: 0 })));
      const { passwordGrant, getValidAccessToken } = await loadAuth();
      await passwordGrant("admin@example.test", "hunter2");
      vi.mocked(fetch).mockClear();

      await getValidAccessToken();
      await getValidAccessToken();

      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("falls back to the persisted refresh token when memory is cold", async () => {
      localStorage.setItem(REFRESH_TOKEN_KEY, "refresh-stored");
      const { getValidAccessToken } = await loadAuth();

      await expect(getValidAccessToken()).resolves.toBe(adminToken);
      expect(formBody(0).get("refresh_token")).toBe("refresh-stored");
    });
  });

  describe("logoutKeycloak", () => {
    it("revokes the session at Keycloak and clears local storage", async () => {
      localStorage.setItem(REFRESH_TOKEN_KEY, "refresh-stored");
      const { logoutKeycloak } = await loadAuth();

      await logoutKeycloak();

      const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
      expect(url).toBe(LOGOUT_ENDPOINT);
      expect(formBody(0).get("refresh_token")).toBe("refresh-stored");
      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    });

    it("clears local tokens even when revocation fails", async () => {
      vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));
      localStorage.setItem(REFRESH_TOKEN_KEY, "refresh-stored");
      const { logoutKeycloak } = await loadAuth();

      await expect(logoutKeycloak()).resolves.toBeUndefined();

      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    });

    it("skips the round trip when there is nothing to revoke", async () => {
      const { logoutKeycloak } = await loadAuth();

      await logoutKeycloak();

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("decodeUser", () => {
    it("falls back to `name` when there is no preferred_username", async () => {
      const { decodeUser } = await loadAuth();

      expect(decodeUser(jwt({ sub: "s", name: "Full Name" }))).toEqual({
        id: "s",
        email: "",
        username: "Full Name",
      });
    });

    it("leaves the optional claims empty rather than undefined", async () => {
      const { decodeUser } = await loadAuth();

      expect(decodeUser(jwt({ sub: "s" }))).toEqual({
        id: "s",
        email: "",
        username: "",
      });
    });
  });
});
