// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Coordinates, CreateTrailRequest, Trail, TrailCard, TrailOverview, TrailShortInfoResponse } from "@/data/types";
import uuid from "react-native-uuid";
import { ApiError } from "./api-error";
import { BASE_URL } from "./api-config";
import { getUserToken } from "./users";
import { logger } from "@/services/logger";

export async function getPopularTrails(latitude?: number, longitude?: number): Promise<TrailOverview[]> {
  try {
    const params = new URLSearchParams();

    if (latitude !== undefined && longitude !== undefined) {
      params.append("latitude", latitude.toString());
      params.append("longitude", longitude.toString());
    }
    // Se över om vi ska ha någon API-nyckel här för att autentisera appen
    // och för att undvika att någon kan spamma och döda servern?
    const query = params.toString();
    const url = `${BASE_URL}/trails/popular${query ? `?${query}` : ""}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    return response.json();
  } catch (error) {
    logger.error("Failed to fetch popular trails", {
      endpoint: "GET /trails/popular",
      errorMessage: error instanceof Error ? String(error.cause ?? error.message) : String(error),
    });
    throw error;
  }
}

export async function getAllTrails(): Promise<TrailShortInfoResponse[]> {
  try {
    const response = await fetch(`${BASE_URL}/trails`);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    return response.json();
  } catch (error) {
    logger.error("Failed to fetch all trails", {
      endpoint: "GET /trails",
      errorMessage: error instanceof Error ? String(error.cause ?? error.message) : String(error),
    });
    throw error;
  }
}

export async function getTrailByIdentifier(identifier: string): Promise<Trail> {
  try {
    const response = await fetch(`${BASE_URL}/trails/${identifier}`);

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const json = await response.json();

    return json;
  } catch (error) {
    logger.error("Failed to fetch trail by identifier", {
      endpoint: "GET /trails/{identifier}",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function getTrailCard(identifier: string): Promise<TrailCard> {
  try {
    const response = await fetch(`${BASE_URL}/trails/${identifier}/card`);

    if (!response.ok) {
      throw new Error(`getTrailCard: HTTP error ${response.status}`);
    }

    return response.json();
  } catch (error) {
    logger.error("Failed to fetch trail card", {
      endpoint: "GET /trails/{identifier}/card",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function getTrailCards(identifiers: string[]): Promise<TrailCard[]> {
  try {
    const response = await fetch(`${BASE_URL}/trails/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers }),
    });

    if (!response.ok) {
      throw new Error(`getTrailCards: HTTP error ${response.status}`);
    }

    return response.json();
  } catch (error) {
    logger.error("Failed to fetch trail cards", { endpoint: "GET /trails/cards", errorMessage: String(error) });
    throw error;
  }
}

export async function getCoordinatesByTrailIdentifier(identifier: string): Promise<Coordinates> {
  try {
    const response = await fetch(`${BASE_URL}/trails/${identifier}/coordinates`);

    if (!response.ok) {
      throw new Error(`getCordsTrailByIdentifier: HTTP error ${response.status}`);
    }
    const json = await response.json();

    return json;
  } catch (error) {
    logger.error("Failed to fetch trail coordinates", {
      endpoint: "GET /trails/{identifier}/coordinates",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function addTrail(request: CreateTrailRequest): Promise<{ success: boolean }> {
  const token = await getUserToken();

  if (!token) throw new Error("User not authenticated!");

  const formData = new FormData();

  request.images?.forEach((uri) => {
    const fileName = `${uuid.v4()}.jpg`;

    formData.append("images", {
      uri: uri,
      type: "image/jpeg",
      name: fileName,
    } as any);
  });

  formData.append("trailSymbolImage", {
    uri: request.trailSymbolImage,
    type: "image/jpeg",
    name: `${uuid.v4()}.jpg`,
  } as any);

  formData.append("name", request.name);
  formData.append("trailLength", `${request.trailLength}`);
  formData.append("classification", `${request.classification}`);
  formData.append("accessibility", `${request.accessibility}`);
  formData.append("accessibilityInfo", `${request.accessibilityInfo}`);
  formData.append("trailSymbol", `${request.trailSymbol}`);
  formData.append("description", `${request.description}`);
  formData.append("fullDescription", `${request.fullDescription}`);
  formData.append("coordinates", `${request.coordinates}`);
  formData.append("tags", `${request.tags}`);
  formData.append("isVerified", `${request.isVerified}`);
  formData.append("city", `${request.city}`);

  try {
    const response = await fetch(`${BASE_URL}/trails/create`, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`addTrail: HTTP error ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    logger.error("Trail creation failed", { endpoint: "POST /trails", errorMessage: String(error) });
    throw error;
  }
}
