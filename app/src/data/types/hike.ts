// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { LatLng } from "./geo";

export interface HikeImage {
  identifier: string;
  imageUrl: string;
}

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
  images: HikeImage[];
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
  // Omitted or null leaves the name unchanged.
  name?: string | null;
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
  sharedByName: string | null; // keep-comment: null once the sharer deleted their account
  sharedByIdentifier: string | null;
  sharedAt: string;
  gettingThere?: string;
  parkingInfo?: string;
  description?: string;
  allowResharing: boolean;
  images: HikeImage[];
}

export interface ReshareSharedHikeRequest {
  hikeIdentifier: string;
  reShareToNames: string[];
}

export interface ShareHikeRequest {
  hikeIdentifier: string;
  sharedWithNames: string[];
  allowResharing: boolean;
}

export interface ShareRecipient {
  identifier: string;
  nickName: string;
  sharedAt: string;
}

export interface OutgoingSharedHike {
  hikeIdentifier: string;
  hikeName: string;
  hikeLength: number;
  duration: number;
  coordinates: string;
  isOwnHike: boolean;
  imageUrl?: string | null;
  lastSharedAt: string;
  recipients: ShareRecipient[];
}

export interface IncomingSharedHike {
  hikeIdentifier: string;
  hikeName: string;
  hikeLength: number;
  duration: number;
  sharedByName: string | null;
  sharedByIdentifier: string | null;
  createdByName: string | null;
  sharedAt: string;
}
