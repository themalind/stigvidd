// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { logger } from "@/services/logger";

interface Props {
  data: string;
  identifier: string;
}

interface RawCoordinate {
  latitude: number;
  longitude: number;
}

// keep-comment: the one place { latitude, longitude } becomes [longitude, latitude]
// keep-comment: drops bad points, since a NaN would corrupt the route line and the camera bounds
export default function CoordinateParser({ data, identifier }: Props): GeoJSON.Position[] {
  try {
    const raw: unknown = JSON.parse(data);

    if (!Array.isArray(raw)) {
      logger.warn("Coordinates payload is not an array", { identifier });
      return [];
    }

    const positions: GeoJSON.Position[] = [];
    for (const point of raw as readonly (Partial<RawCoordinate> | null)[]) {
      const lat = point?.latitude;
      const lng = point?.longitude;
      if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
        positions.push([lng, lat]);
      }
    }

    return positions;
  } catch (error) {
    logger.warn("Failed to parse coordinates", { identifier, error: String(error) });
    return [];
  }
}
