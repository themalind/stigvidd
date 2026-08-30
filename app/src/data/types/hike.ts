// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { LatLng } from "./geo";

export interface Hike {
  identifier: string;
  name: string;
  hikeLength: number;
  duration: number;
  coordinates?: string;
  createdBy: string;
  gettingThere?: string;
  parkingInfo?: string;
  description?: string;
  createdAt: string;
}

export interface CreateHikeRequest {
  name: string;
  hikeLength: number;
  duration: number;
  coordinates: LatLng[];
}

export interface DeleteHikeRequest {
  hikeIdentifier: string;
  userIdentifier: string;
}

export interface UpdateHikeRequest {
  hikeIdentifier: string;
  parkingInfo: string | null;
  gettingThere: string | null;
  description: string | null;
}

export interface SharedHike {
  hikeIdentifier: string;
  hikeName: string;
  hikeLength: number;
  duration: number;
  coordinates: string;
  createdByName: string | null;
  sharedByName: string;
  sharedByIdentifier: string;
  sharedAt: string;
  gettingThere?: string;
  parkingInfo?: string;
  description?: string;
  allowResharing: boolean;
}

export interface ReshareSharedHikeRequest {
  hikeIdentifier: string;
  reShareToName: string;
}

export interface ShareHikeRequest {
  hikeIdentifier: string;
  sharedWithName: string;
  allowResharing: boolean;
}

export interface IncomingSharedHike {
  hikeIdentifier: string;
  hikeName: string;
  hikeLength: number;
  duration: number;
  sharedByName: string;
  sharedByIdentifier: string;
  createdByName: string | null;
  sharedAt: string;
}
