// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { CreateTrailObstacleRequest, TrailObstacle, UpdateTrailObstacleRequest } from "@/data/types";
import { BASE_URL } from "./api-config";
import { getUserToken } from "./users";
import { ApiError } from "./api-error";
import { logger } from "@/services/logger";

export async function getTrailObstaclesByTrailIdentifier(trailIdentifier: string): Promise<TrailObstacle[]> {
  try {
    const response = await fetch(`${BASE_URL}/trailobstacles/trail/${trailIdentifier}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getTrailObstaclesByTrailIdentifier:  ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    logger.error("Get trail obstacles by trail identifier failed", {
      endpoint: "GET /trailobstacles/trail/{param}",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function addSolvedVote(obstacleIdentifier: string): Promise<{ success: boolean }> {
  try {
    const token = await getUserToken();

    const response = await fetch(`${BASE_URL}/trailobstacles/solve/${obstacleIdentifier}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: addSolvedVote:  ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    logger.error("Add solved vote failed", {
      endpoint: "POST /trailobstacles/solve/{param}",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function deleteSolvedVote(obstacleIdentifier: string): Promise<{ success: boolean }> {
  try {
    const token = await getUserToken();

    const response = await fetch(`${BASE_URL}/trailobstacles/solve/${obstacleIdentifier}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: deleteSolvedVote:  ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    logger.error("Delete solved vote failed", {
      endpoint: "DELETE /trailobstacles/solve/{param}",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function createTrailObstacle(request: CreateTrailObstacleRequest): Promise<{ success: boolean }> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`${BASE_URL}/trailobstacles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: createTrailObstacle:  ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    logger.error("Create trail obstacle failed", {
      endpoint: "POST /trailobstacles",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function updateTrailObstacle(
  obstacleIdentifier: string,
  request: UpdateTrailObstacleRequest,
): Promise<{ success: boolean }> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`${BASE_URL}/trailobstacles/${obstacleIdentifier}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: updateTrailObstacle: ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    logger.error("Update trail obstacle failed", {
      endpoint: "PUT /trailobstacles/{param}",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function getObstacleIssueTypes(): Promise<string[]> {
  try {
    const response = await fetch(`${BASE_URL}/trailobstacles/issue-types`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getObstacleIssueTypes:  ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    logger.error("Get obstacle issue types failed", {
      endpoint: "GET /trailobstacles/issue-types",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function deleteTrailObstacle(trailObstacleIdentifier: string): Promise<{ success: boolean }> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }
    const response = await fetch(`${BASE_URL}/trailobstacles/${trailObstacleIdentifier}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: deleteTrailObstacle:  ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    logger.error("Delete trail obstacle failed", {
      endpoint: "DELETE /trailobstacles/{param}",
      errorMessage: String(error),
    });
    throw error;
  }
}
