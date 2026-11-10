// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { CreateHikeRequest, Hike, HikeImage, ShareHikeRequest, UpdateHikeRequest } from "@/data/types";
import { UPLOAD_TIMEOUT_MS } from "./core/api-config";
import { imageFormPart } from "./core/image-form-part";
import { send, sendForJson } from "./core/request";

export async function createHike(request: CreateHikeRequest): Promise<{ success: boolean }> {
  await send({
    name: "createHike",
    method: "POST",
    path: "/hikes",
    endpoint: "/hikes",
    body: { ...request, coordinates: JSON.stringify(request.coordinates) },
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });
  return { success: true };
}

export function updateHike(request: UpdateHikeRequest): Promise<Hike> {
  return sendForJson({
    name: "updateHike",
    method: "PUT",
    path: `/hikes/${request.hikeIdentifier}`,
    endpoint: "/hikes/{param}",
    body: request,
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });
}

export const hikeRouteQueryKey = (hikeIdentifier: string) => ["hike-route", hikeIdentifier] as const;

export function getHikeByIdentifier(hikeIdentifier: string): Promise<Hike> {
  return sendForJson({ name: "getHikeByIdentifier", path: `/hikes/${hikeIdentifier}`, endpoint: "/hikes/{param}" });
}

export function getAllHikesByUserId(userIdentifier: string): Promise<Hike[]> {
  return sendForJson({ name: "getAllHikesByUserId", path: `/hikes?createdBy=${userIdentifier}`, endpoint: "/hikes" });
}

export async function shareHike(request: ShareHikeRequest): Promise<{ success: boolean }> {
  await send({
    name: "shareHike",
    method: "POST",
    path: "/hikeshares/share",
    endpoint: "/hikeshares/share",
    body: request,
  });
  return { success: true };
}

export async function deleteHike(hikeIdentifier: string): Promise<{ success: boolean }> {
  await send({ name: "deleteHike", method: "DELETE", path: `/hikes/${hikeIdentifier}`, endpoint: "/hikes/{param}" });
  return { success: true };
}

export function uploadHikeImage(hikeIdentifier: string, uri: string): Promise<HikeImage> {
  const form = new FormData();
  form.append("image", imageFormPart(uri));

  return sendForJson({
    name: "uploadHikeImage",
    method: "POST",
    path: `/hikes/${hikeIdentifier}/images`,
    endpoint: "/hikes/{param}/images",
    form,
  });
}

export async function deleteHikeImage(hikeIdentifier: string, imageIdentifier: string): Promise<{ success: boolean }> {
  await send({
    name: "deleteHikeImage",
    method: "DELETE",
    path: `/hikes/${hikeIdentifier}/images/${imageIdentifier}`,
    endpoint: "/hikes/{param}/images/{param}",
  });
  return { success: true };
}
