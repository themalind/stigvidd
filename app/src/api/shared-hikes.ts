// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { IncomingSharedHike, OutgoingSharedHike, ReshareSharedHikeRequest, SharedHike } from "@/data/types";
import { send, sendForJson } from "./core/request";

export function getSharedHikes(): Promise<SharedHike[]> {
  return sendForJson({ name: "getSharedHikes", path: "/hikesharerecipient", endpoint: "/hikesharerecipient" });
}

export function getOutgoingSharedHikes(): Promise<OutgoingSharedHike[]> {
  return sendForJson({
    name: "getOutgoingSharedHikes",
    path: "/hikeshares/outgoing",
    endpoint: "/hikeshares/outgoing",
  });
}

export async function reshareHike(request: ReshareSharedHikeRequest): Promise<{ success: boolean }> {
  await send({
    name: "reshareHike",
    method: "POST",
    path: "/hikesharerecipient/re-share",
    endpoint: "/hikesharerecipient/re-share",
    body: request,
  });
  return { success: true };
}

export async function removeSharedHike(hikeIdentifier: string): Promise<{ success: boolean }> {
  await send({
    name: "removeSharedHike",
    method: "DELETE",
    path: `/hikesharerecipient/${hikeIdentifier}`,
    endpoint: "/hikesharerecipient/{param}",
  });
  return { success: true };
}

export function getIncomingSharedHike(hikeIdentifier: string): Promise<SharedHike> {
  return sendForJson({
    name: "getIncomingSharedHike",
    path: `/hikesharerecipient/incoming/${hikeIdentifier}`,
    endpoint: "/hikesharerecipient/incoming/{param}",
  });
}

export function getIncomingSharedHikes(): Promise<IncomingSharedHike[]> {
  return sendForJson({
    name: "getIncomingSharedHikes",
    path: "/hikesharerecipient/incoming",
    endpoint: "/hikesharerecipient/incoming",
  });
}

export async function acceptSharedHike(hikeIdentifier: string): Promise<{ success: boolean }> {
  await send({
    name: "acceptSharedHike",
    method: "PUT",
    path: `/hikesharerecipient/accept/${hikeIdentifier}`,
    endpoint: "/hikesharerecipient/accept/{param}",
  });
  return { success: true };
}

export async function rejectSharedHike(hikeIdentifier: string): Promise<{ success: boolean }> {
  await send({
    name: "rejectSharedHike",
    method: "DELETE",
    path: `/hikesharerecipient/reject/${hikeIdentifier}`,
    endpoint: "/hikesharerecipient/reject/{param}",
  });
  return { success: true };
}
