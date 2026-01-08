import { AuthResult, LoginData } from "@/data/types";
import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../../firebase-config";

export const signInUser = async (data: LoginData): Promise<AuthResult> => {
  try {
    const userCredentials = await signInWithEmailAndPassword(
      auth,
      data.email,
      data.password,
    );
    return { success: true, user: userCredentials.user, error: null };
  } catch (error) {
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
    return {
      success: false,
      user: null,
      error: {
        code: "unknown",
        message: "Ett oväntat fel inträffade",
      },
    };
  }
};

export async function signOutUser() {
  try {
    await signOut(auth);
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Kunde inte logga ut",
    };
  }
}
