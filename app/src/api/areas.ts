// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { CityArea } from "@/data/types";
import { positionQuery, sendForJson } from "./core/request";

// keep-comment: nearest first with a position, else most popular first
export function getAreas(latitude?: number, longitude?: number): Promise<CityArea[]> {
  return sendForJson({
    name: "getAreas",
    path: `/cityareas${positionQuery(latitude, longitude)}`,
    endpoint: "/cityareas",
    auth: "none",
  });
}

export function getAreaByIdentifier(areaIdentifier: string): Promise<CityArea> {
  return sendForJson({
    name: "getAreaByIdentifier",
    path: `/cityareas/${areaIdentifier}`,
    endpoint: "/cityareas/{param}",
    auth: "none",
  });
}
