import { authLoadingAtom, userAtom } from "@/atoms/auth-atoms";
import { registerAccount } from "@/api/auth";
import { deleteStigViddUser } from "@/api/users";
import { AuthUser, RegisterData } from "@/data/types";
import { unregisterForPushNotificationsAsync } from "@/services/notifications";
import {
  logoutKeycloak,
  passwordGrant,
  restoreSession,
  setSessionExpiredHandler,
} from "@/services/keycloak-auth";
import { useAtomValue, useSetAtom } from "jotai";
import { queryClientAtom } from "jotai-tanstack-query";
import { useEffect } from "react";

/**
 * Thrown by register() when the account was provisioned successfully but the
 * follow-up auto-login failed. The account exists — the user just needs to log
 * in manually — so callers should route to the login screen, not show a generic
 * error.
 */
export class RegisteredButLoginFailedError extends Error {
  constructor() {
    super("registered-but-login-failed");
    this.name = "RegisteredButLoginFailedError";
  }
}

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
  // Read the QueryClient from the jotai atom (set in the root layout) rather than
  // useQueryClient(): useAuth() also runs in RootLayout, which renders the
  // QueryClientProvider and therefore sits above it — useQueryClient() would throw.
  const queryClient = useAtomValue(queryClientAtom);

  const login = async (email: string, password: string) => {
    setUser(await passwordGrant(email, password));
  };

  const register = async (data: RegisterData) => {
    // Backend provisions the Keycloak user and the StigVidd DB record.
    await registerAccount(data);
    // Then auto-login via Direct Access Grant. The account already exists at this
    // point, so a login failure here is recoverable — surface it distinctly so the
    // screen can route to login instead of showing a generic "registration failed".
    try {
      setUser(await passwordGrant(data.email, data.password));
    } catch {
      throw new RegisteredButLoginFailedError();
    }
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
