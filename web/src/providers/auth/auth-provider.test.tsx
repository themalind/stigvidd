// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import type { AuthUser, StigviddUser } from "@/types/types";
import { AuthProvider } from "./auth-provider";
import { useAuth } from "./auth-context";
import { ProtectedRoute } from "@/components/auth/protected-route";

const keycloak = vi.hoisted(() => ({
  getValidAccessToken: vi.fn(),
  logoutKeycloak: vi.fn(),
  passwordGrant: vi.fn(),
  restoreSession: vi.fn(),
  setSessionExpiredHandler: vi.fn(),
}));
vi.mock("@/services/keycloak-auth", () => keycloak);

const userApi = vi.hoisted(() => ({ getStigviddUser: vi.fn() }));
vi.mock("@/api/user", () => userApi);

const admin: AuthUser = { id: "user-1", email: "admin@example.test", username: "admin" };
const profile: StigviddUser = {
  identifier: "abc",
  nickName: "Admin",
  email: "admin@example.test",
};

/** Renders the context so the tests can read and drive it from the outside. */
function Probe() {
  const auth = useAuth();

  return (
    <div>
      <span data-testid="state">
        {auth.isLoading
          ? "loading"
          : auth.isAuthenticated
            ? `signed in as ${auth.user?.username}`
            : "signed out"}
      </span>
      <span data-testid="profile">{auth.stigviddUser?.nickName ?? "no profile"}</span>
      <button onClick={() => void auth.login("admin@example.test", "hunter2")}>
        Sign in
      </button>
      <button onClick={() => void auth.logout()}>Sign out</button>
    </div>
  );
}

function renderAuth() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

const state = () => screen.getByTestId("state").textContent;

beforeEach(() => {
  keycloak.restoreSession.mockResolvedValue(null);
  keycloak.passwordGrant.mockResolvedValue(admin);
  keycloak.logoutKeycloak.mockResolvedValue(undefined);
  userApi.getStigviddUser.mockResolvedValue(profile);
});

describe("restoring a session on start-up", () => {
  it("holds at loading until the refresh token has been exchanged", async () => {
    let release: (value: AuthUser | null) => void = () => {};
    keycloak.restoreSession.mockReturnValue(new Promise((resolve) => (release = resolve)));

    renderAuth();

    expect(state()).toBe("loading");
    release(null);
    await waitFor(() => expect(state()).toBe("signed out"));
  });

  it("comes back signed in when the stored session is still good", async () => {
    keycloak.restoreSession.mockResolvedValue(admin);

    renderAuth();

    await waitFor(() => expect(state()).toBe("signed in as admin"));
    expect(screen.getByTestId("profile")).toHaveTextContent("Admin");
  });

  it("comes back signed out when there is nothing stored", async () => {
    renderAuth();

    await waitFor(() => expect(state()).toBe("signed out"));
    expect(userApi.getStigviddUser).not.toHaveBeenCalled();
  });

  // The Keycloak session is the authority; a missing row in our own database must not
  // lock an admin out of the tool.
  it("stays signed in when the backend profile cannot be read", async () => {
    keycloak.restoreSession.mockResolvedValue(admin);
    userApi.getStigviddUser.mockRejectedValue(new Error("HTTP error 404"));

    renderAuth();

    await waitFor(() => expect(state()).toBe("signed in as admin"));
    expect(screen.getByTestId("profile")).toHaveTextContent("no profile");
  });
});

describe("signing in and out", () => {
  it("signs in and loads the profile", async () => {
    renderAuth();
    await waitFor(() => expect(state()).toBe("signed out"));

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(state()).toBe("signed in as admin"));
    expect(keycloak.passwordGrant).toHaveBeenCalledWith("admin@example.test", "hunter2");
    expect(screen.getByTestId("profile")).toHaveTextContent("Admin");
  });

  it("revokes at Keycloak and drops both identities", async () => {
    keycloak.restoreSession.mockResolvedValue(admin);
    renderAuth();
    await waitFor(() => expect(state()).toBe("signed in as admin"));

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(state()).toBe("signed out"));
    expect(keycloak.logoutKeycloak).toHaveBeenCalledOnce();
    expect(screen.getByTestId("profile")).toHaveTextContent("no profile");
  });
});

describe("a session that expires mid-use", () => {
  it("registers a handler with the token layer", async () => {
    renderAuth();

    await waitFor(() => expect(keycloak.setSessionExpiredHandler).toHaveBeenCalled());
    expect(keycloak.setSessionExpiredHandler.mock.calls[0][0]).toBeTypeOf("function");
  });

  // What the handler is for: a refresh that Keycloak genuinely rejects has to flip the
  // app to signed-out, or the admin goes on clicking against a dead session.
  it("drops to signed out when the token layer says the session is gone", async () => {
    keycloak.restoreSession.mockResolvedValue(admin);
    renderAuth();
    await waitFor(() => expect(state()).toBe("signed in as admin"));

    const expire = keycloak.setSessionExpiredHandler.mock.calls[0][0] as () => void;
    expire();

    await waitFor(() => expect(state()).toBe("signed out"));
    expect(screen.getByTestId("profile")).toHaveTextContent("no profile");
  });

  it("unregisters the handler on unmount, so a dead provider is not called", async () => {
    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(keycloak.setSessionExpiredHandler).toHaveBeenCalled());

    unmount();

    expect(keycloak.setSessionExpiredHandler).toHaveBeenLastCalledWith(null);
  });
});

/** The SPA's own gate. Everything behind it assumes an authenticated admin. */
describe("ProtectedRoute", () => {
  function renderRoutes() {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/admin"]}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/admin" element={<p>the admin</p>} />
            </Route>
            <Route path="/login" element={<p>the login page</p>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );
  }

  it("sends a signed-out visitor to the login page", async () => {
    renderRoutes();

    expect(await screen.findByText("the login page")).toBeInTheDocument();
    expect(screen.queryByText("the admin")).not.toBeInTheDocument();
  });

  it("lets a signed-in admin through", async () => {
    keycloak.restoreSession.mockResolvedValue(admin);

    renderRoutes();

    expect(await screen.findByText("the admin")).toBeInTheDocument();
  });

  // Deciding before the restore has finished would bounce a signed-in admin to /login on
  // every reload, so while it is loading the gate renders nothing at all.
  it("shows neither while the session is still being restored", () => {
    keycloak.restoreSession.mockReturnValue(new Promise(() => {}));

    renderRoutes();

    expect(screen.queryByText("the admin")).not.toBeInTheDocument();
    expect(screen.queryByText("the login page")).not.toBeInTheDocument();
  });
});
