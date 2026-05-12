import { getIdToken, onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "../../../firebase-config";
import { AuthContext } from "./auth-context";
import { getStigviddUser } from "@/api/user";
import type { StigviddUser } from "@/types/types";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [stigviddUser, setStigviddUser] = useState<StigviddUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const profile = await getStigviddUser();
          setStigviddUser(profile);
        } catch {
          setStigviddUser(null);
        }
      } else {
        setStigviddUser(null);
      }

      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  async function getToken(): Promise<string | null> {
    if (!auth.currentUser) return null;
    return getIdToken(auth.currentUser);
  }

  return (
    <AuthContext.Provider
      value={{ user, stigviddUser, isLoading, isAuthenticated: user !== null, getToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}
