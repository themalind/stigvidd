// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { IncomingSharedHike, ReshareSharedHikeRequest, SharedHike } from "@/data/types";
import { BASE_URL } from "./api-config";
import { getUserToken } from "./users";
import { ApiError } from "./api-error";
import { logger } from "@/services/logger";

export async function getSharedHikes(): Promise<SharedHike[]> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/hikesharerecipient`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getSharedHikes: ${response.status}`, response.status);
    }

    return response.json();
  } catch (error) {
    logger.error("Get shared hikes failed", {
      endpoint: "GET /hikesharerecipient",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function reshareHike(request: ReshareSharedHikeRequest): Promise<{ success: boolean }> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/hikesharerecipient/re-share`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: reshareHike: ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    logger.error("Reshare hike failed", {
      endpoint: "POST /hikesharerecipient/re-share",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function removeSharedHike(hikeIdentifier: string): Promise<{ success: boolean }> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/hikesharerecipient/${hikeIdentifier}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: removeSharedHike: ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    logger.error("Remove shared hike failed", {
      endpoint: "DELETE /hikesharerecipient/{param}",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function getIncomingSharedHike(hikeIdentifier: string): Promise<SharedHike> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/hikesharerecipient/incoming/${hikeIdentifier}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getIncomingSharedHike: ${response.status}`, response.status);
    }
    return await response.json();
  } catch (error) {
    logger.error("Get incoming shared hike failed", {
      endpoint: "GET /hikesharerecipient/incoming/{param}",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function getIncomingSharedHikes(): Promise<IncomingSharedHike[]> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/hikesharerecipient/incoming`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getIncomingSharedHikes: ${response.status}`, response.status);
    }
    return await response.json();
  } catch (error) {
    logger.error("Get incoming shared hikes failed", {
      endpoint: "GET /hikesharerecipient/incoming",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function acceptSharedHike(hikeIdentifier: string): Promise<{ success: boolean }> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/hikesharerecipient/accept/${hikeIdentifier}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: acceptSharedHike: ${response.status}`, response.status);
    }
    return { success: true };
  } catch (error) {
    logger.error("Accept shared hike failed", {
      endpoint: "PUT /hikesharerecipient/accept/{param}",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function rejectSharedHike(hikeIdentifier: string): Promise<{ success: boolean }> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/hikesharerecipient/reject/${hikeIdentifier}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: rejectSharedHike: ${response.status}`, response.status);
    }
    return { success: true };
  } catch (error) {
    logger.error("Reject shared hike failed", {
      endpoint: "DELETE /hikesharerecipient/reject/{param}",
      errorMessage: String(error),
    });
    throw error;
  }
}
