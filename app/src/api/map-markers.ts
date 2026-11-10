// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Facility, TrailMarkerResponse } from "@/data/types";
import { sendForJson } from "./core/request";

export function getTrailMarkers(): Promise<TrailMarkerResponse[]> {
  return sendForJson({ name: "getTrailMarkers", path: "/trails/markers", endpoint: "/trails/markers", auth: "none" });
}

export function getFacilityMarkers(): Promise<Facility[]> {
  return sendForJson({ name: "getFacilityMarkers", path: "/facilities", endpoint: "/facilities", auth: "none" });
}
