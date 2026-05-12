import { createContext, useContext } from "react";
import type { User } from "firebase/auth";
import type { StigviddUser } from "@/types/types";

export type AuthContextValue = {
  user: User | null;
  stigviddUser: StigviddUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  getToken: () => Promise<string | null>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
