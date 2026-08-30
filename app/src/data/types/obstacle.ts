// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

export interface UpdateTrailObstacleRequest {
  description?: string;
  issueType?: string;
}

export interface CreateTrailObstacleRequest {
  description: string;
  issueType: string;
  trailIdentifier: string;
  incidentLongitude: number | null;
  incidentLatitude: number | null;
}

export interface TrailObstacle {
  identifier: string;
  // Null once the reporter has deleted their account.
  userIdentifier: string | null;
  description: string;
  issueType: string;
  incidentLongitude?: number;
  incidentLatitude?: number;
  createdAt: string;
  solvedVotes?: TrailObstacleSolvedVote[];
}

export interface TrailObstacleSolvedVote {
  userIdentifier: string;
  trailObstacleIdentifier: string;
}
