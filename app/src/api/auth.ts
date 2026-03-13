import { AuthResult, LoginData, UpdateUserResult } from "@/data/types";
import { FirebaseError } from "firebase/app";
import { EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../../firebase-config";
import { deleteStigViddUser } from "./users";

export const signInUser = async (data: LoginData): Promise<AuthResult> => {
  try {
    const userCredentials = await signInWithEmailAndPassword(auth, data.email, data.password);
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

export async function userPasswordReset(email: string): Promise<UpdateUserResult> {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true, error: null };
  } catch (error) {
    if (error instanceof FirebaseError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      };
    }
    return {
      success: false,
      error: {
        code: "unknown",
        message: "Ett oväntat fel inträffade",
      },
    };
  }
}

export async function DeleteUserAccount(password: string): Promise<UpdateUserResult> {
  const user = auth.currentUser;

  if (!user || !user.email) {
    return { success: false, error: { code: "unknown", message: "Ingen användare inloggad" } };
  }

  // Step 1: Re-authenticate to verify identity before destructive action
  try {
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
  } catch (error) {
    if (error instanceof FirebaseError) {
      return { success: false, error: { code: error.code, message: error.message } };
    }
    return { success: false, error: { code: "unknown", message: "Ett oväntat fel inträffade" } };
  }

  // Step 2: Backend deletes StigVidd user from DB and Firebase account atomically
  try {
    await deleteStigViddUser();
  } catch {
    return { success: false, error: { code: "api/delete-failed", message: "Kunde inte ta bort kontot från servern" } };
  }

  // Step 3: Sign out locally — Firebase account is already gone
  await signOut(auth);
  return { success: true, error: null };
}
