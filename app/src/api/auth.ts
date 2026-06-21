import i18n from "@/i18n";
import { RegisterData, UpdateUserResult } from "@/data/types";
import { BASE_URL } from "./api-config";
import { ApiError } from "./api-error";

/**
 * Provision a new account: the backend creates the Keycloak user (via the
 * Keycloak Admin API) and the matching StigVidd DB record in one call.
 * Throws ApiError("nickname-taken", 409) when the nickname is taken.
 */
export async function registerAccount(data: RegisterData): Promise<void> {
  const response = await fetch(`${BASE_URL}/account/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: data.email,
      nickName: data.nickName,
      password: data.password,
    }),
  });

  if (response.status === 409) {
    throw new ApiError("nickname-taken", 409);
  }

  if (!response.ok) {
    throw new ApiError(`HTTP error ${response.status}`, response.status);
  }
}

/**
 * Ask the backend to trigger a Keycloak password-reset email.
 * The backend always responds 2xx (it does not reveal whether the email exists),
 * so this resolves successfully unless the network/server fails.
 */
export async function userPasswordReset(email: string): Promise<UpdateUserResult> {
  try {
    const response = await fetch(`${BASE_URL}/account/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "unknown",
        message: error instanceof Error ? error.message : i18n.t("auth.unknownError"),
      },
    };
  }
}
