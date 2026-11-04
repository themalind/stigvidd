// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AdminCityAreaResponse } from "./generated/model";
import {
  adminCityAreasGetAll,
  adminCityAreasLinkFacility,
  adminCityAreasLinkTrail,
  adminCityAreasUnlinkFacility,
  adminCityAreasUnlinkTrail,
} from "./generated/admin-city-areas/admin-city-areas";

export async function getAdminCityAreas(): Promise<AdminCityAreaResponse[]> {
  return await adminCityAreasGetAll();
}

export async function setFacilityLinked(area: string, facility: string, linked: boolean): Promise<void> {
  await (linked ? adminCityAreasLinkFacility(area, facility) : adminCityAreasUnlinkFacility(area, facility));
}

export async function setTrailLinked(area: string, trail: string, linked: boolean): Promise<void> {
  await (linked ? adminCityAreasLinkTrail(area, trail) : adminCityAreasUnlinkTrail(area, trail));
}
