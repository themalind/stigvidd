import { useCallback, useEffect, useState } from "react";
import { AuthContext } from "./auth-context";
import { getStigviddUser } from "@/api/user";
import type { AuthUser, StigviddUser } from "@/types/types";
import {
  getValidAccessToken,
  logoutKeycloak,
  passwordGrant,
  restoreSession,
  setSessionExpiredHandler,
} from "@/services/keycloak-auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [stigviddUser, setStigviddUser] = useState<StigviddUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch the backend profile for a signed-in user; tolerate its absence.
  const loadProfile = useCallback(async () => {
    try {
      setStigviddUser(await getStigviddUser());
    } catch {
      setStigviddUser(null);
    }
  }, []);

  // Restore a session on load (exchange the stored refresh token).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const restored = await restoreSession();
      if (cancelled) return;
      setUser(restored);
      if (restored) await loadProfile();
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  // If a mid-session refresh fails, drop to signed-out so the guard shows /login.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStigviddUser(null);
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const authUser = await passwordGrant(email, password);
      setUser(authUser);
      await loadProfile();
    },
    [loadProfile],
  );

  const logout = useCallback(async () => {
    await logoutKeycloak();
    setUser(null);
    setStigviddUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        stigviddUser,
        isLoading,
        isAuthenticated: user !== null,
        getToken: getValidAccessToken,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
