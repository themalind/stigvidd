// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Facility, TrailMarkerResponse } from "@/data/types";
import { BASE_URL } from "./api-config";
import { logger } from "@/services/logger";

export async function getTrailMarkers(): Promise<TrailMarkerResponse[]> {
  try {
    const response = await fetch(`${BASE_URL}/trails/markers`);

    if (!response.ok) {
      throw new Error(`getTrailMarkers: HTTP error ${response.status}`);
    }
    const json = await response.json();

    return json;
  } catch (error) {
    logger.error("Get trail markers failed", {
      endpoint: "GET /trails/markers",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function getFacilityMarkers(): Promise<Facility[]> {
  try {
    const response = await fetch(`${BASE_URL}/facilities`);

    if (!response.ok) {
      throw new Error(`getFacilityMarkers: HTTP error ${response.status}`);
    }
    const json = await response.json();

    return json;
  } catch (error) {
    logger.error("Get facility markers failed", {
      endpoint: "GET /facilities",
      errorMessage: String(error),
    });
    throw error;
  }
}
