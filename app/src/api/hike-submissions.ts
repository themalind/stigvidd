// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { CreateHikeSubmissionRequest, HikeSubmission } from "@/data/types";
import { apiFetch, BASE_URL, UPLOAD_TIMEOUT_MS } from "./api-config";
import { ApiError } from "./api-error";
import { getUserToken } from "./users";
import { logger } from "@/services/logger";

async function requireToken(): Promise<string> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  return token;
}

export async function createHikeSubmission(request: CreateHikeSubmissionRequest): Promise<HikeSubmission> {
  const token = await requireToken();

  try {
    const response = await apiFetch(
      `${BASE_URL}/hikesubmissions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(request),
      },
      // keep-comment: the server copies every chosen photo before it answers
      UPLOAD_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new ApiError(`HTTP error: createHikeSubmission: ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    logger.error("Create hike submission failed", { endpoint: "POST /hikesubmissions", errorMessage: String(error) });
    throw error;
  }
}

export async function getMyHikeSubmissions(): Promise<HikeSubmission[]> {
  const token = await requireToken();

  try {
    const response = await apiFetch(`${BASE_URL}/hikesubmissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getMyHikeSubmissions: ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    logger.error("Get hike submissions failed", { endpoint: "GET /hikesubmissions", errorMessage: String(error) });
    throw error;
  }
}

export async function withdrawHikeSubmission(identifier: string): Promise<void> {
  const token = await requireToken();

  try {
    const response = await apiFetch(`${BASE_URL}/hikesubmissions/${identifier}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: withdrawHikeSubmission: ${response.status}`, response.status);
    }
  } catch (error) {
    logger.error("Withdraw hike submission failed", {
      endpoint: "DELETE /hikesubmissions/{identifier}",
      errorMessage: String(error),
    });
    throw error;
  }
}
