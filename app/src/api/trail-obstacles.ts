// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { CreateTrailObstacleRequest, TrailObstacle, UpdateTrailObstacleRequest } from "@/data/types";
import { send, sendForJson } from "./core/request";

export function getTrailObstaclesByTrailIdentifier(trailIdentifier: string): Promise<TrailObstacle[]> {
  return sendForJson({
    name: "getTrailObstaclesByTrailIdentifier",
    path: `/trailobstacles/trail/${trailIdentifier}`,
    endpoint: "/trailobstacles/trail/{param}",
    auth: "optional",
  });
}

export async function addSolvedVote(obstacleIdentifier: string): Promise<{ success: boolean }> {
  await send({
    name: "addSolvedVote",
    method: "POST",
    path: `/trailobstacles/solve/${obstacleIdentifier}`,
    endpoint: "/trailobstacles/solve/{param}",
  });
  return { success: true };
}

export async function deleteSolvedVote(obstacleIdentifier: string): Promise<{ success: boolean }> {
  await send({
    name: "deleteSolvedVote",
    method: "DELETE",
    path: `/trailobstacles/solve/${obstacleIdentifier}`,
    endpoint: "/trailobstacles/solve/{param}",
  });
  return { success: true };
}

export async function createTrailObstacle(request: CreateTrailObstacleRequest): Promise<{ success: boolean }> {
  await send({
    name: "createTrailObstacle",
    method: "POST",
    path: "/trailobstacles",
    endpoint: "/trailobstacles",
    body: request,
  });
  return { success: true };
}

export async function updateTrailObstacle(
  obstacleIdentifier: string,
  request: UpdateTrailObstacleRequest,
): Promise<{ success: boolean }> {
  await send({
    name: "updateTrailObstacle",
    method: "PUT",
    path: `/trailobstacles/${obstacleIdentifier}`,
    endpoint: "/trailobstacles/{param}",
    body: request,
  });
  return { success: true };
}

export function getObstacleIssueTypes(): Promise<string[]> {
  return sendForJson({
    name: "getObstacleIssueTypes",
    path: "/trailobstacles/issue-types",
    endpoint: "/trailobstacles/issue-types",
    auth: "none",
  });
}

export async function deleteTrailObstacle(trailObstacleIdentifier: string): Promise<{ success: boolean }> {
  await send({
    name: "deleteTrailObstacle",
    method: "DELETE",
    path: `/trailobstacles/${trailObstacleIdentifier}`,
    endpoint: "/trailobstacles/{param}",
  });
  return { success: true };
}
