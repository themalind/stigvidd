// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { CreateHikeRequest, Hike, ShareHikeRequest, UpdateHikeRequest } from "@/data/types";
import { BASE_URL } from "./api-config";
import { getUserToken } from "./users";
import { ApiError } from "./api-error";
import { logger } from "@/services/logger";

export async function createHike(request: CreateHikeRequest): Promise<{ success: boolean }> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  const response = await fetch(`${BASE_URL}/hikes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...request,
      coordinates: JSON.stringify(request.coordinates),
    }),
  });

  if (!response.ok) {
    throw new ApiError(`HTTP error: createHike: ${response.status}`, response.status);
  }

  return { success: true };
}

export async function updateHike(request: UpdateHikeRequest): Promise<Hike> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`${BASE_URL}/hikes/${request.hikeIdentifier}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: updateHike: ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    logger.error("Update hike failed", {
      endpoint: "PUT /hikes/{param}",
      errorMessage: String(error),
    });
    throw error;
  }
}

// Keyed on the hike alone. Only the raw coordinate JSON is cached under this key, and a
// recorded walk's geometry never changes — unlike its gettingThere / parkingInfo /
// description, which updateHike can rewrite. Keeping them on separate keys is what lets
// the geometry hold a 24 h staleTime safely.
export const hikeRouteQueryKey = (hikeIdentifier: string) => ["hike-route", hikeIdentifier] as const;

// Readable by the hike's creator *and* by anyone it has been shared with — the API
// authorises both (HikeService.GetHikeByIdentifierAsync), so the follow screen needs
// only this one call whether you own the hike or a friend sent it to you.
export async function getHikeByIdentifier(hikeIdentifier: string): Promise<Hike> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`${BASE_URL}/hikes/${hikeIdentifier}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getHikeByIdentifier: ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    logger.error("Get hike by identifier failed", {
      endpoint: "GET /hikes/{param}",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function getAllHikesByUserId(userIdentifier: string): Promise<Hike[]> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }
  try {
    const response = await fetch(`${BASE_URL}/hikes?createdBy=${userIdentifier}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getAllHikesByUserId: ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    logger.error("Get all hikes by user id failed", {
      endpoint: "GET /hikes",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function shareHike(request: ShareHikeRequest): Promise<{ success: boolean }> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`${BASE_URL}/hikeshares/share`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: shareHike: ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    logger.error("Share hike failed", {
      endpoint: "POST /hikeshares/share",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function deleteHike(hikeIdentifier: string): Promise<{ success: boolean }> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`${BASE_URL}/hikes/${hikeIdentifier}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: deleteHike: ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    logger.error("Delete hike failed", {
      endpoint: "DELETE /hikes/{param}",
      errorMessage: String(error),
    });
    throw error;
  }
}
