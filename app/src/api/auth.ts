// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import i18n from "@/i18n";
import { RegisterData, UpdateUserResult } from "@/data/types";
import { apiFetch, BASE_URL } from "./core/api-config";
import { ApiError } from "./core/api-error";
import { logger } from "@/services/logger";

async function readConflictCode(response: Response): Promise<string> {
  try {
    const body = (await response.text()).trim().replace(/^"|"$/g, "");
    if (body === "nickname-taken" || body === "email-taken") return body;
  } catch {
    // keep-comment: an unreadable body is a generic conflict
  }
  return "registration-conflict";
}

export async function registerAccount(data: RegisterData): Promise<void> {
  try {
    const response = await apiFetch(`${BASE_URL}/account/register`, {
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
  } catch (error) {
    logger.error("Register account failed", {
      endpoint: "POST /account/register",
      errorMessage: String(error),
    });
    throw error;
  }
}

// keep-comment: unauthenticated, since the account stays disabled until this succeeds
export async function verifyEmailCode(email: string, code: string): Promise<void> {
  try {
    const response = await apiFetch(`${BASE_URL}/account/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    if (response.ok) {
      return;
    }

    throw new ApiError(await readVerificationCode(response), response.status);
  } catch (error) {
    logger.error("Verify email code failed", {
      endpoint: "POST /account/verify-email",
      errorMessage: String(error),
    });
    throw error;
  }
}

async function readVerificationCode(response: Response): Promise<string> {
  try {
    const body = (await response.text()).trim().replace(/^"|"$/g, "");
    if (body === "invalid-code" || body === "code-expired" || body === "too-many-attempts") return body;
  } catch {
    // keep-comment: an unreadable body is a generic failure
  }
  return "verification-failed";
}

// keep-comment: always 204, so nothing reveals whether the address is registered
export async function resendVerification(email: string): Promise<void> {
  try {
    const response = await apiFetch(`${BASE_URL}/account/resend-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }
  } catch (error) {
    logger.error("Resend verification failed", {
      endpoint: "POST /account/resend-verification",
      errorMessage: String(error),
    });
    throw error;
  }
}

// keep-comment: always 2xx, so nothing reveals whether the address exists
export async function userPasswordReset(email: string): Promise<UpdateUserResult> {
  try {
    const response = await apiFetch(`${BASE_URL}/account/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }

    return { success: true, error: null };
  } catch (error) {
    logger.error("Password reset request failed", {
      endpoint: "POST /account/forgot-password",
      errorMessage: String(error),
    });
    return {
      success: false,
      error: {
        code: "unknown",
        message: error instanceof Error ? error.message : i18n.t("auth.unknownError"),
      },
    };
  }
}
