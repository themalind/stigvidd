// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { registerAccount } from "@/api/auth";
import { deleteStigViddUser } from "@/api/users";
import { authLoadingAtom, userAtom } from "@/atoms/auth-atoms";
import { RegisteredButLoginFailedError, useAuth, useInitAuth } from "@/components/auth/auth-provider";
import { AuthUser, RegisterData } from "@/data/types";
import { logoutKeycloak, passwordGrant, restoreSession, setSessionExpiredHandler } from "@/services/keycloak-auth";
import { unregisterForPushNotificationsAsync } from "@/services/notifications";
import { renderWithProviders } from "@/test/render";
import { act, screen } from "@testing-library/react-native";

jest.mock("@/api/auth", () => ({ registerAccount: jest.fn() }));
jest.mock("@/api/users", () => ({ deleteStigViddUser: jest.fn() }));
jest.mock("@/services/notifications", () => ({ unregisterForPushNotificationsAsync: jest.fn() }));
jest.mock("@/services/keycloak-auth", () => ({
  passwordGrant: jest.fn(),
  logoutKeycloak: jest.fn(),
  restoreSession: jest.fn(),
  setSessionExpiredHandler: jest.fn(),
}));

const register = registerAccount as jest.Mock;
const deleteUser = deleteStigViddUser as jest.Mock;
const unregisterPush = unregisterForPushNotificationsAsync as jest.Mock;
const grant = passwordGrant as jest.Mock;
const keycloakLogout = logoutKeycloak as jest.Mock;
const restore = restoreSession as jest.Mock;
const setExpiredHandler = setSessionExpiredHandler as jest.Mock;

const USER: AuthUser = { id: "u-1", email: "vandrare@stigvidd.se", username: "Vandraren" };
const FORM: RegisterData = {
  nickName: "Vandraren",
  email: "vandrare@stigvidd.se",
  password: "Hemligt123!",
  confirmPassword: "Hemligt123!",
};

// A probe hands the hook's return value out of the tree so a test can call login/logout as a screen does.
let auth: ReturnType<typeof useAuth>;

function AuthProbe() {
  auth = useAuth();
  return null;
}

function InitProbe() {
  useInitAuth();
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  grant.mockResolvedValue(USER);
  register.mockResolvedValue(undefined);
  deleteUser.mockResolvedValue(undefined);
  unregisterPush.mockResolvedValue(undefined);
  keycloakLogout.mockResolvedValue(undefined);
  restore.mockResolvedValue(null);
});

function show(signedIn = false) {
  return renderWithProviders(<AuthProbe />, {
    initialAtoms: signedIn ? [[userAtom, USER] as [typeof userAtom, unknown]] : [],
  });
}

// The screens branch on what these calls throw, so the error comes back rather than being swallowed.
async function attempt(action: () => Promise<void>) {
  let thrown: unknown;
  await act(async () => {
    await action().catch((error: unknown) => {
      thrown = error;
    });
  });
  return thrown;
}

it("starts signed out, and says so", () => {
  show();

  expect(auth.user).toBeNull();
  expect(auth.isAuthenticated).toBe(false);
});

it("reports the signed-in user to every screen that asks", () => {
  show(true);

  expect(auth.user).toEqual(USER);
  expect(auth.isAuthenticated).toBe(true);
});

it("holds the first paint until the stored session has been looked at", () => {
  show();

  expect(auth.isLoading).toBe(true);
});

it("signs the user in with the credentials they typed", async () => {
  const { store } = show();

  await attempt(() => auth.login("vandrare@stigvidd.se", "Hemligt123!"));

  expect(grant).toHaveBeenCalledWith("vandrare@stigvidd.se", "Hemligt123!");
  expect(store.get(userAtom)).toEqual(USER);
});

it("leaves the user signed out when the credentials are wrong", async () => {
  const { store } = show();
  const rejected = new Error("invalid-credentials");
  grant.mockRejectedValueOnce(rejected);

  const thrown = await attempt(() => auth.login("vandrare@stigvidd.se", "fel"));

  expect(thrown).toBe(rejected);
  expect(store.get(userAtom)).toBeNull();
});

it("creates the account and signs straight in with it", async () => {
  const { store } = show();

  await attempt(() => auth.register(FORM));

  expect(register).toHaveBeenCalledWith(FORM);
  expect(grant).toHaveBeenCalledWith(FORM.email, FORM.password);
  expect(store.get(userAtom)).toEqual(USER);
});

// The account exists at this point, so the user is sent to the login form, not told the registration failed.
it("marks a registration whose auto-login failed as its own kind of failure", async () => {
  const { store } = show();
  grant.mockRejectedValueOnce(new Error("network"));

  const thrown = await attempt(() => auth.register(FORM));

  expect(thrown).toBeInstanceOf(RegisteredButLoginFailedError);
  expect(register).toHaveBeenCalledTimes(1);
  expect(store.get(userAtom)).toBeNull();
});

// A registration that never reached the backend is not recoverable by logging in.
it("passes a failed registration on as it came", async () => {
  show();
  const rejected = new Error("e-post upptagen");
  register.mockRejectedValueOnce(rejected);

  const thrown = await attempt(() => auth.register(FORM));

  expect(thrown).toBe(rejected);
  expect(grant).not.toHaveBeenCalled();
});

it("signs out of Keycloak, drops the push registration and forgets the user", async () => {
  const { store, queryClient } = show(true);
  const clear = jest.spyOn(queryClient, "clear");

  await attempt(() => auth.logout());

  expect(unregisterPush).toHaveBeenCalled();
  expect(keycloakLogout).toHaveBeenCalled();
  expect(store.get(userAtom)).toBeNull();
  expect(clear).toHaveBeenCalled();
});

// A push registration that cannot be dropped must not leave the user stuck signed in.
it("signs out even when the push registration cannot be dropped", async () => {
  const { store } = show(true);
  unregisterPush.mockRejectedValueOnce(new Error("no network"));

  await attempt(() => auth.logout());

  expect(keycloakLogout).toHaveBeenCalled();
  expect(store.get(userAtom)).toBeNull();
});

it("refuses to delete an account when nobody is signed in", async () => {
  show();

  const thrown = await attempt(() => auth.deleteAccount("Hemligt123!"));

  expect((thrown as Error).message).toBe("not-authenticated");
  expect(grant).not.toHaveBeenCalled();
  expect(deleteUser).not.toHaveBeenCalled();
});

// Deleting is irreversible, so the password is checked against the signed-in account first.
it("re-checks the password against the signed-in account before deleting", async () => {
  show(true);

  await attempt(() => auth.deleteAccount("Hemligt123!"));

  expect(grant).toHaveBeenCalledWith(USER.email, "Hemligt123!");
  expect(deleteUser).toHaveBeenCalled();
});

it("deletes nothing when the password is wrong, and stays signed in", async () => {
  const { store } = show(true);
  const rejected = new Error("invalid-credentials");
  grant.mockRejectedValueOnce(rejected);

  const thrown = await attempt(() => auth.deleteAccount("fel"));

  expect(thrown).toBe(rejected);
  expect(deleteUser).not.toHaveBeenCalled();
  expect(store.get(userAtom)).toEqual(USER);
});

it("signs the user out once the account is gone", async () => {
  const { store, queryClient } = show(true);
  const clear = jest.spyOn(queryClient, "clear");

  await attempt(() => auth.deleteAccount("Hemligt123!"));

  expect(keycloakLogout).toHaveBeenCalled();
  expect(store.get(userAtom)).toBeNull();
  expect(clear).toHaveBeenCalled();
});

// A deletion that failed on the server leaves the session alone.
it("keeps the session when the account could not be deleted", async () => {
  const { store } = show(true);
  deleteUser.mockRejectedValueOnce(new Error("500"));

  await attempt(() => auth.deleteAccount("Hemligt123!"));

  expect(keycloakLogout).not.toHaveBeenCalled();
  expect(store.get(userAtom)).toEqual(USER);
});

it("brings back the session stored on the device at start-up", async () => {
  restore.mockResolvedValue(USER);

  const { store } = renderWithProviders(<InitProbe />);
  await act(async () => {});

  expect(store.get(userAtom)).toEqual(USER);
  expect(store.get(authLoadingAtom)).toBe(false);
});

it("lets the first paint through when there is no session to restore", async () => {
  const { store } = renderWithProviders(<InitProbe />);
  await act(async () => {});

  expect(store.get(userAtom)).toBeNull();
  expect(store.get(authLoadingAtom)).toBe(false);
});

// A failed refresh drops back to the signed-out state, or the guards leave the user where every call 401s.
it("signs the user out when the session expires while the app is open", async () => {
  restore.mockResolvedValue(USER);
  const { store, queryClient } = renderWithProviders(<InitProbe />);
  await act(async () => {});
  expect(store.get(userAtom)).toEqual(USER);
  const clear = jest.spyOn(queryClient, "clear");

  const onExpired = setExpiredHandler.mock.calls[0][0];
  act(() => onExpired());

  expect(store.get(userAtom)).toBeNull();
  expect(clear).toHaveBeenCalled();
});

it("takes the expiry handler back down with the tree", async () => {
  renderWithProviders(<InitProbe />);
  await act(async () => {});

  screen.unmount();

  expect(setExpiredHandler).toHaveBeenLastCalledWith(null);
});

// The restore outlives a tree that unmounts while it is in flight, so it writes no user afterwards.
it("drops a session that finishes restoring after the tree is gone", async () => {
  let finish: (user: AuthUser | null) => void = () => {};
  restore.mockReturnValue(
    new Promise<AuthUser | null>((resolve) => {
      finish = resolve;
    }),
  );
  const { store } = renderWithProviders(<InitProbe />);

  screen.unmount();
  await act(async () => {
    finish(USER);
  });

  expect(store.get(userAtom)).toBeNull();
  expect(store.get(authLoadingAtom)).toBe(true);
});
