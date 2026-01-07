import { onAuthStateChanged, User } from "firebase/auth";
import { atom } from "jotai";
import { auth } from "../../firebase-config";

/**
 * Atom that holds the current authenticated user
 * null = not authenticated
 * User = authenticated user object
 */
export const userAtom = atom<User | null>(null);

/**
 * Write-only atom to update user profile
 */
export const updateUserAtom = atom(null, (get, set, user: User) => {
  set(userAtom, user);
  console.log("userAtom uppdaterad!");
});

/**
 * Atom that tracks auth loading state
 * true = checking auth state
 * false = auth state determined
 */
export const authLoadingAtom = atom<boolean>(true);

/**
 * Atom with read-only derived auth state
 * Combines user and loading state for convenience
 */
export const authStateAtom = atom((get) => ({
  user: get(userAtom),
  isLoading: get(authLoadingAtom),
  isAuthenticated: get(userAtom) !== null,
}));

/**
 * Write-only atom to initialize auth listener
 * Call this once in your app root to set up Firebase auth listener
 */
export const initAuthAtom = atom(null, (get, set) => {
  const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
    console.log("onAuthStateChanged triggered", currentUser?.displayName);
    set(userAtom, currentUser);
    set(authLoadingAtom, false);
  });
  return unsubscribe;
});
