// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { authLoadingAtom, userAtom } from "@/atoms/auth-atoms";
import { registerAccount } from "@/api/auth";
import { deleteStigViddUser } from "@/api/users";
import { AuthUser, RegisterData } from "@/data/types";
import { unregisterForPushNotificationsAsync } from "@/services/notifications";
import { logoutKeycloak, passwordGrant, restoreSession, setSessionExpiredHandler } from "@/services/keycloak-auth";
import { useAtomValue, useSetAtom } from "jotai";
import { queryClientAtom } from "jotai-tanstack-query";
import { useEffect } from "react";

interface Auth {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-verify the password, delete the account (DB + Keycloak), then sign out. */
  deleteAccount: (password: string) => Promise<void>;
}

/**
 * Keycloak Direct Access Grant auth, backed by Jotai atoms (a global store, no React
 * Context), so it can also be read from a component that renders the bootstrap itself.
 */
export function useAuth(): Auth {
  const user = useAtomValue(userAtom);
  const isLoading = useAtomValue(authLoadingAtom);
  const setUser = useSetAtom(userAtom);
  // Read the QueryClient from the jotai atom (set in the root layout) rather than
  // useQueryClient(): useAuth() also runs in RootLayout, which renders the
  // QueryClientProvider and therefore sits above it — useQueryClient() would throw.
  const queryClient = useAtomValue(queryClientAtom);

  const login = async (email: string, password: string) => {
    setUser(await passwordGrant(email, password));
  };

  const register = async (data: RegisterData) => {
    // Backend provisions the Keycloak user (DISABLED) and the StigVidd DB record, then
    // mails a verification link and code.
    //
    // There is deliberately no auto-login here: the account cannot log in until the
    // address is verified, so a password grant would only fail. The caller routes to the
    // verification screen instead.
    await registerAccount(data);
  };

  const logout = async () => {
    await unregisterForPushNotificationsAsync().catch(() => {});
    await logoutKeycloak();
    setUser(null);
    // Drop the signed-out user's cached data from memory. Correctness is already
    // guaranteed by user-scoped query keys; this is memory hygiene.
    queryClient.clear();
  };

  const deleteAccount = async (password: string) => {
    if (!user) {
      throw new Error("not-authenticated");
    }
    // Re-verify identity before the destructive action (throws InvalidCredentialsError).
    await passwordGrant(user.email, password);
    // Backend removes the StigVidd DB record and the Keycloak user.
    await deleteStigViddUser();
    await logout();
  };

  return { user, isAuthenticated: !!user, isLoading, login, register, logout, deleteAccount };
}

/**
 * Restores a session on app start: load stored tokens and refresh once.
 * Call once near the root, OUTSIDE any conditional render, so it runs even
 * while the first paint is gated on auth resolving.
 */
export function useInitAuth(): void {
  const setUser = useSetAtom(userAtom);
  const setIsLoading = useSetAtom(authLoadingAtom);
  const queryClient = useAtomValue(queryClientAtom);

  // When a refresh fails mid-session, drop back to the signed-out state so the
  // route guards swap to the login screen instead of stranding the user on a
  // screen whose API calls all 401.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      queryClient.clear();
    });
    return () => setSessionExpiredHandler(null);
  }, [setUser, queryClient]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const restored = await restoreSession();
      if (!cancelled) {
        setUser(restored);
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUser, setIsLoading]);
}
