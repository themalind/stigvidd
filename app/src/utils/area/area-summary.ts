// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { CityArea } from "@/data/types";
import { formatDistanceKm } from "@/utils/format/format-distance";
import { TFunction } from "i18next";

// keep-comment: "Borås · 3 leder", either half left out when missing
export function areaSummary(area: CityArea, t: TFunction): string {
  const trails = area.trails.length > 0 ? t("area.trailCount", { count: area.trails.length }) : null;
  return [area.municipality, trails].filter(Boolean).join(" · ");
}

export function areaDistance(area: CityArea): string | null {
  return area.distanceKm === null || area.distanceKm === undefined ? null : formatDistanceKm(area.distanceKm);
}
