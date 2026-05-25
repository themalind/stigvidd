import { ApiError, createStigViddUser } from "@/api/users";
import { AuthResult, RegisterData } from "@/data/types";
import i18n from "@/i18n";
import { FirebaseError } from "firebase/app";
import { User, createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { auth } from "../../firebase-config";

// Detta är tänkt att fungera som en transaction. Om något av stegen går fel ska ingen användare skapas.
export async function registerUser(data: RegisterData): Promise<AuthResult> {
  let firebaseUser: User | null = null;

  try {
    // Add a namecheck to see if wanted username is free before creating a firebaseuser.
    // If not it the api will send back an error triggering the rollback flow.
    // Create FirebaseUser
    const response = await createUserWithEmailAndPassword(auth, data.email, data.password);

    if (!response) {
      throw new Error("Could not create a firebase user!");
    }

    firebaseUser = response.user;

    // Create StigviddUser
    const result = await createStigViddUser({
      email: data.email,
      nickname: data.nickName,
    });

    if (!result) {
      throw new Error("Could not create a stigvidd user!");
    }

    return { success: true, user: response.user, error: null };
  } catch (error) {
    // If a firebase user was created but something went wrong while creating stigvidduser, remove firebaseuser.
    if (firebaseUser) {
      try {
        await deleteUser(firebaseUser);
        console.warn("registerUser: Could not create user! Deleted by rollback.");
      } catch (deleteError) {
        console.error("Failed to rollback:", deleteError);
      }
    }

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

    if (error instanceof ApiError && error.message === "nickname-taken") {
      return {
        success: false,
        user: null,
        error: {
          code: "api/nickname-taken",
          message: i18n.t("auth.nicknameTakenMsg"),
        },
      };
    }

    return {
      success: false,
      user: null,
      error: {
        code: "unknown",
        message: i18n.t("auth.unknownError"),
      },
    };
  }
}
