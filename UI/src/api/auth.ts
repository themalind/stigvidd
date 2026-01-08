import { router } from "expo-router";
import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";
import { auth } from "../../firebase-config";
import { createStigViddUser } from "./users";

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  nickName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface AuthResult {
  success: boolean;
  user: User | null;
  error: { code: string; message: string } | null;
}

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

export const registerUser = async (data: RegisterData): Promise<AuthResult> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      data.email,
      data.password,
    );

    await updateProfile(userCredential.user, {
      displayName: data.nickName,
    });

    // Skapar en User i vår backend med firebase-Uid som nyckel för att kunna kopplas ihop.
    try {
      await createStigViddUser({
        email: data.email,
        nickname: data.nickName,
        firebaseUid: userCredential.user.uid,
      });
    } catch (error) {
      console.log(error);
      throw error;
    }

    await userCredential.user.reload();
    router.replace("/(tabs)");

    return { success: true, user: userCredential.user, error: null };
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
