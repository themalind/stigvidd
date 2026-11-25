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
import { logger } from "@/services/logger";
import { unregisterForPushNotificationsAsync } from "@/services/notifications";
import { logoutKeycloak, passwordGrant, restoreSession, setSessionExpiredHandler } from "@/services/keycloak-auth";
import { cancellation } from "@/utils/cancellation";
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
  deleteAccount: (password: string) => Promise<void>;
}

// keep-comment: jotai, not Context, so the component rendering the providers can read it too
export function useAuth(): Auth {
  const user = useAtomValue(userAtom);
  const isLoading = useAtomValue(authLoadingAtom);
  const setUser = useSetAtom(userAtom);
  // keep-comment: not useQueryClient(), which throws in RootLayout above the provider
  const queryClient = useAtomValue(queryClientAtom);

  const login = async (email: string, password: string) => {
    setUser(await passwordGrant(email, password));
  };

  const register = async (data: RegisterData) => {
    // keep-comment: no auto-login: the account is disabled until the address is verified
    await registerAccount(data);
  };

  const logout = async () => {
    await unregisterForPushNotificationsAsync().catch(() => {});
    await logoutKeycloak();
    setUser(null);
    // keep-comment: memory hygiene only; user-scoped keys already keep data apart
    queryClient.clear();
  };

  const deleteAccount = async (password: string) => {
    if (!user) {
      throw new Error("not-authenticated");
    }
    await passwordGrant(user.email, password, "delete-account");
    await deleteStigViddUser();
    await logout();
  };

  return { user, isAuthenticated: !!user, isLoading, login, register, logout, deleteAccount };
}

// keep-comment: call outside any conditional render, since the first paint waits on it
export function useInitAuth(): void {
  const setUser = useSetAtom(userAtom);
  const setIsLoading = useSetAtom(authLoadingAtom);
  const queryClient = useAtomValue(queryClientAtom);

  // keep-comment: a failed refresh signs out, or the user is stranded on a screen of 401s
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      queryClient.clear();
    });
    return () => setSessionExpiredHandler(null);
  }, [setUser, queryClient]);

  useEffect(() => {
    const { isCancelled, cancel } = cancellation();
    void (async () => {
      const restored = await restoreSession().catch((error: unknown) => {
        logger.warn("Session restore failed", { errorMessage: String(error) });
        return null;
      });
      if (!isCancelled()) {
        setUser(restored);
        setIsLoading(false);
      }
    })();
    return cancel;
  }, [setUser, setIsLoading]);
}
