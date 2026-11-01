// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getCoordinatesByTrailIdentifier } from "@/api/trails";
import { TRAIL_COORDINATES_STALE_TIME } from "@/constants/cache";
import { useQuery } from "@tanstack/react-query";

type Options = {
  enabled?: boolean;
  staleTime?: number;
};

export function useTrailCoordinates(
  identifier: string | undefined,
  { enabled = true, staleTime = TRAIL_COORDINATES_STALE_TIME }: Options = {},
) {
  return useQuery({
    queryKey: ["cords", identifier],
    queryFn: () => {
      if (!identifier) throw new Error("expected a trail identifier");
      return getCoordinatesByTrailIdentifier(identifier);
    },
    enabled: enabled && !!identifier,
    staleTime,
  });
}
