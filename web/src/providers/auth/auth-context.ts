import { createContext, useContext } from "react";
import type { AuthUser, StigviddUser } from "@/types/types";

export type AuthContextValue = {
  user: AuthUser | null;
  stigviddUser: StigviddUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  getToken: () => Promise<string | null>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
