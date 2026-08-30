// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// App-owned geographic coordinate in the device/wire format ({ latitude, longitude }).
// Used by GPS tracking, geolib distance and the hike-creation request payload.
// Map rendering uses GeoJSON Position ([lng, lat]) instead — see utils/geojson.ts.
export interface LatLng {
  latitude: number;
  longitude: number;
}

export type LocationData = {
  data: LatLng;
  timeStamp: number;
};

export type Segment = {
  coordinates: LocationData[];
  distance: number;
  startTime: number;
  endTime?: number;
};

export type ActiveHike = {
  segments: Segment[];
  totalDistance: number;
  totalTime: number;
};

export type MapMarkerFilter = {
  trails: boolean;
  shelters: boolean;
  firePits: boolean;
  accessibility: boolean;
};
