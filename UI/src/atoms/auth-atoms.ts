import { createStigViddUser } from "@/api/users";
import { AuthResult, RegisterData } from "@/data/types";
import { router } from "expo-router";
import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile,
  User,
} from "firebase/auth";
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

// TODO Fundera lite över den här, är detta bästa lösningen?
export const registerUserAtom = atom(
  null,
  async (_, set, data: RegisterData): Promise<AuthResult> => {
    try {
      set(isRegisteringAtom, true);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password,
      );

      // Bör ha nån transaktion här?
      await updateProfile(userCredential.user, {
        displayName: data.nickName,
      });

      await createStigViddUser({
        email: data.email,
        nickname: data.nickName,
        firebaseUid: userCredential.user.uid,
      });

      await userCredential.user.reload();

      set(isRegisteringAtom, false);
      set(userAtom, userCredential.user);
      set(authLoadingAtom, false);

      router.replace("/(tabs)");
      return { success: true, user: userCredential.user, error: null };
    } catch (error) {
      set(isRegisteringAtom, false);
      if (error instanceof FirebaseError) {
        return {
          success: false,
          user: null,
          error: {
            code: error.code,
            message: error.message,
          },
        };
      }
      console.error(`registerUserAtom: ${error}`);
      return {
        success: false,
        user: null,
        error: {
          code: "unknown",
          message: "Ett oväntat fel inträffade",
        },
      };
    }
  },
);
