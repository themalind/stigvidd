// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { useUserLocation } from "@/hooks/location/useUserLocation";
import { roundTo } from "@/utils/format/round-to";

// keep-comment: the user's real position rounded to about a kilometre, so GPS drift does not make a new query; the Borås fallback never reaches the API
export function useApproximatePosition() {
  const { data: location, isPending } = useUserLocation();
  const position = location?.isFallback ? undefined : location;

  return {
    latitude: roundTo(position?.latitude, 2),
    longitude: roundTo(position?.longitude, 2),
    hasPosition: position !== undefined,
    isPending,
  };
}
