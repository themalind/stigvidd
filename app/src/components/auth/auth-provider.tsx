import { authLoadingAtom, userAtom } from "@/atoms/auth-atoms";
import { registerAccount } from "@/api/auth";
import { deleteStigViddUser } from "@/api/users";
import { AuthUser, RegisterData } from "@/data/types";
import { unregisterForPushNotificationsAsync } from "@/services/notifications";
import { loadTokens, logoutKeycloak, passwordGrant, refreshGrant } from "@/services/keycloak-auth";
import { useAtomValue, useSetAtom } from "jotai";
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
 * Keycloak Direct Access Grant auth, backed by Jotai atoms (global store, no
 * React Context) so it works the same way the old singleton-based useOidcAuth
 * did — including when read from a component that renders the bootstrap itself.
 */
export function useAuth(): Auth {
  const user = useAtomValue(userAtom);
  const isLoading = useAtomValue(authLoadingAtom);
  const setUser = useSetAtom(userAtom);

  const login = async (email: string, password: string) => {
    setUser(await passwordGrant(email, password));
  };

  const register = async (data: RegisterData) => {
    // Backend provisions the Keycloak user and the StigVidd DB record.
    await registerAccount(data);
    // Then auto-login via Direct Access Grant.
    setUser(await passwordGrant(data.email, data.password));
  };

  const logout = async () => {
    await unregisterForPushNotificationsAsync().catch(() => {});
    await logoutKeycloak();
    setUser(null);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { refreshToken } = await loadTokens();
      const restored = refreshToken ? await refreshGrant(refreshToken) : null;
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
