import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../../firebase-config";

export async function signInUser(email: string, password: string) {
  try {
    const credentials = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: credentials.user, error: null };
  } catch (error) {
    if (error instanceof FirebaseError) {
      return {
        success: false,
        user: null,
        error: { code: error.code, message: error.message },
      };
    }
    return {
      success: false,
      user: null,
      error: { code: "unknown", message: "An unexpected error occurred" },
    };
  }
}

export async function signOutUser() {
  try {
    await signOut(auth);
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not sign out",
    };
  }
}
