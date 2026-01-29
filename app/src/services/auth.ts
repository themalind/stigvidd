import { createStigViddUser } from "@/api/users";
import { AuthResult, RegisterData } from "@/data/types";
import { FirebaseError } from "firebase/app";
import {
  User,
  createUserWithEmailAndPassword,
  deleteUser,
} from "firebase/auth";
import { auth } from "../../firebase-config";

// Detta är tänkt att fungera som en transaction. Om något av stegen går fel ska ingen användare skapas.
export async function registerUser(data: RegisterData): Promise<AuthResult> {
  let firebaseUser: User | null = null;

  try {
    // Skapa Firebaseanvändare
    const response = await createUserWithEmailAndPassword(
      auth,
      data.email,
      data.password,
    );

    if (!response) {
      throw new Error("Could not create a firebase user!");
    }

    firebaseUser = response.user;

    // Skapa StigViddanvändare
    const result = await createStigViddUser({
      email: data.email,
      nickname: data.nickName,
    });

    if (!result) {
      throw new Error("Could not create a stigvidd user!");
    }

    return { success: true, user: response.user, error: null };
  } catch (error) {
    // Om vi skapade en Firebase-användare men något gick fel när stigviddanvändaren skulle skapas, ta bort firebase användaren.
    if (firebaseUser) {
      try {
        await deleteUser(firebaseUser);
        console.warn(
          "registerUser: Could not create user! Deleted by rollback.",
        );
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

    return {
      success: false,
      user: null,
      error: {
        code: "unknown",
        message: "Ett oväntat fel inträffade",
      },
    };
  }
}
