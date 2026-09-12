// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import i18n from "@/i18n";
import { RegisterData, UpdateUserResult } from "@/data/types";
import { BASE_URL } from "./api-config";
import { ApiError } from "./api-error";

/** Reads the conflict code from a 409 body; an unrecognised body is a generic conflict. */
async function readConflictCode(response: Response): Promise<string> {
  try {
    const body = (await response.text()).trim().replace(/^"|"$/g, "");
    if (body === "nickname-taken" || body === "email-taken") return body;
  } catch {
    // fall through to the generic code
  }
  return "registration-conflict";
}

/**
 * Provision a new account: the backend creates the Keycloak user (via the
 * Keycloak Admin API) and the matching StigVidd DB record in one call.
 * A 409 throws ApiError carrying the code for the field that collided.
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
    throw new ApiError(await readConflictCode(response), 409);
  }

  if (!response.ok) {
    throw new ApiError(`HTTP error ${response.status}`, response.status);
  }
}

/**
 * Settle the email verification with the six-digit code from the mail. Unauthenticated:
 * until this succeeds the Keycloak user is disabled, so there is no token to send.
 *
 * Throws ApiError carrying the backend's code — "invalid-code", "code-expired" or
 * "too-many-attempts" — so the screen can say which of the three happened.
 */
export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/account/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });

  if (response.ok) {
    return;
  }

  throw new ApiError(await readVerificationCode(response), response.status);
}

/** Reads the verification failure code from the body; an unrecognised body is a generic failure. */
async function readVerificationCode(response: Response): Promise<string> {
  try {
    const body = (await response.text()).trim().replace(/^"|"$/g, "");
    if (body === "invalid-code" || body === "code-expired" || body === "too-many-attempts") return body;
  } catch {
    // fall through to the generic code
  }
  return "verification-failed";
}

/**
 * Ask for a fresh verification mail. The backend always answers 204 — it does not reveal
 * whether the address is registered, already verified, or still inside its resend cooldown —
 * so this resolves unless the network or server fails.
 */
export async function resendVerification(email: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/account/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

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
