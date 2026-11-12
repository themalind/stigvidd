// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import {
  Coordinates,
  CreateTrailRequest,
  Trail,
  TrailCard,
  TrailLike,
  TrailOverview,
  TrailShortInfoResponse,
} from "@/data/types";
import { imageFormPart } from "./core/image-form-part";
import { positionQuery, send, sendForJson } from "./core/request";

export function getPopularTrails(latitude?: number, longitude?: number): Promise<TrailOverview[]> {
  return sendForJson({
    name: "getPopularTrails",
    path: `/trails/popular${positionQuery(latitude, longitude)}`,
    endpoint: "/trails/popular",
    auth: "none",
  });
}

export function getPopularContributedTrails(latitude?: number, longitude?: number): Promise<TrailCard[]> {
  return sendForJson({
    name: "getPopularContributedTrails",
    path: `/trails/popular-contributions${positionQuery(latitude, longitude)}`,
    endpoint: "/trails/popular-contributions",
    auth: "none",
  });
}

function trailLikeRequest(identifier: string, method: "GET" | "PUT" | "DELETE"): Promise<TrailLike> {
  return sendForJson({
    name: "trailLike",
    method,
    path: `/trails/${identifier}/like`,
    endpoint: "/trails/{param}/like",
  });
}

export const getTrailLike = (identifier: string) => trailLikeRequest(identifier, "GET");
export const likeTrail = (identifier: string) => trailLikeRequest(identifier, "PUT");
export const unlikeTrail = (identifier: string) => trailLikeRequest(identifier, "DELETE");

export function getAllTrails(): Promise<TrailShortInfoResponse[]> {
  return sendForJson({ name: "getAllTrails", path: "/trails", endpoint: "/trails", auth: "none" });
}

export function getTrailByIdentifier(identifier: string): Promise<Trail> {
  return sendForJson({
    name: "getTrailByIdentifier",
    path: `/trails/${identifier}`,
    endpoint: "/trails/{param}",
    auth: "none",
  });
}

export function getTrailCard(identifier: string): Promise<TrailCard> {
  return sendForJson({
    name: "getTrailCard",
    path: `/trails/${identifier}/card`,
    endpoint: "/trails/{param}/card",
    auth: "none",
  });
}

export function getTrailCards(identifiers: string[]): Promise<TrailCard[]> {
  return sendForJson({
    name: "getTrailCards",
    method: "POST",
    path: "/trails/cards",
    endpoint: "/trails/cards",
    body: { identifiers },
    auth: "none",
  });
}

export function getCoordinatesByTrailIdentifier(identifier: string): Promise<Coordinates> {
  return sendForJson({
    name: "getCoordinatesByTrailIdentifier",
    path: `/trails/${identifier}/coordinates`,
    endpoint: "/trails/{param}/coordinates",
    auth: "none",
  });
}

export async function addTrail(request: CreateTrailRequest): Promise<{ success: boolean }> {
  const form = new FormData();

  request.images?.forEach((image) => {
    form.append("images", imageFormPart(image.imageUrl));
  });

  form.append("trailSymbolImage", imageFormPart(request.trailSymbolImage));

  form.append("name", request.name);
  form.append("trailLength", `${request.trailLength}`);
  form.append("classification", `${request.classification}`);
  form.append("accessibility", `${request.accessibility}`);
  form.append("accessibilityInfo", `${request.accessibilityInfo}`);
  form.append("trailSymbol", `${request.trailSymbol}`);
  form.append("description", `${request.description}`);
  form.append("fullDescription", `${request.fullDescription}`);
  form.append("coordinates", `${request.coordinates}`);
  form.append("tags", `${request.tags}`);
  form.append("isVerified", `${request.isVerified}`);
  form.append("city", `${request.city}`);

  await send({ name: "addTrail", method: "POST", path: "/trails/create", endpoint: "/trails/create", form });
  return { success: true };
}
