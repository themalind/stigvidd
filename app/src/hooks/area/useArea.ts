// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getAreaByIdentifier } from "@/api/areas";
import { CITY_AREAS_STALE_TIME } from "@/constants/cache";
import { useQuery } from "@tanstack/react-query";

export const areaQueryKey = (identifier: string) => ["cityArea", identifier] as const;

export function useArea(identifier: string) {
  return useQuery({
    queryKey: areaQueryKey(identifier),
    queryFn: () => getAreaByIdentifier(identifier),
    staleTime: CITY_AREAS_STALE_TIME,
  });
}
