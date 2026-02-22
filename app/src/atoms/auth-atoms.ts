import { RegisterData } from "@/data/types";
import { registerUser } from "@/services/auth";
import { router } from "expo-router";
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
 * Atom flag for register a new user
 */
export const isRegisteringAtom = atom(false);

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
    const isRegistering = get(isRegisteringAtom);
    console.log(
      "onAuthStateChanged triggered",
      currentUser?.displayName,
      "isRegistering:",
      isRegistering,
    );

    if (!isRegistering) {
      set(userAtom, currentUser);
      set(authLoadingAtom, false);
    }
  });
  return unsubscribe;
});

export const registerUserAtom = atom(
  null,
  async (_, set, data: RegisterData) => {
    set(isRegisteringAtom, true);

    const result = await registerUser(data);

    set(isRegisteringAtom, false);

    if (result.success && result.user) {
      set(userAtom, result.user);
      set(authLoadingAtom, false);
      router.replace("/(tabs)/(profile-stack)/profile-page");
    }

    return result;
  },
);
