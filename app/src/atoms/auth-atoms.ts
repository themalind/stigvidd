import { atom } from "jotai";
import { type AuthUser } from "@/data/types";

/**
 * Atom that holds the current authenticated user
 * null = not authenticated
 * AuthUser = authenticated user object (derived from the Keycloak token)
 */
export const userAtom = atom<AuthUser | null>(null);

/**
 * True while the initial session restore (loadTokens + refresh) is in flight.
 * Gates the first render so there is no auth-resolution blink at startup.
 */
export const authLoadingAtom = atom<boolean>(true);

/**
 * Write-only atom to update user profile
 */
export const updateUserAtom = atom(null, (get, set, user: AuthUser | null) => {
  set(userAtom, user);
  console.log("userAtom uppdaterad!");
});
