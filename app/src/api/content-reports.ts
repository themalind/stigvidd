// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ContentReport, CreateContentReportRequest } from "@/data/types";
import { BASE_URL } from "./api-config";
import { getUserToken } from "./users";
import { ApiError } from "./api-error";
import { logger } from "@/services/logger";

export async function getReportReasons(): Promise<string[]> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/contentreports/reasons`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getReportReasons: ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    logger.error("Get report reasons failed", {
      endpoint: "GET /contentreports/reasons",
      errorMessage: String(error),
    });
    throw error;
  }
}

// 409 means this user already reported the same content and 429 that they are over the
// daily cap. Both come back as an ApiError carrying the status so the form can say which.
export async function createContentReport(report: CreateContentReportRequest): Promise<ContentReport> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/contentreports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(report),
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: createContentReport: ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    logger.error("Create content report failed", {
      endpoint: "POST /contentreports",
      errorMessage: String(error),
    });
    throw error;
  }
}
