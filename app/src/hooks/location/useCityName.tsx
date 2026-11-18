// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { REVERSE_GEOCODE_STALE_TIME } from "@/constants/cache";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";

// keep-comment: null, not fallback text, so the wording stays in the component
// keep-comment: disabled without a real position: geocoding needs the permission, and a stand-in names the wrong town
export function useCityName(latitude?: number, longitude?: number) {
  return useQuery<string | null>({
    queryKey: ["reverseGeocode", latitude, longitude],
    queryFn: async () => {
      if (latitude == null || longitude == null) return null;
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      // keep-comment: expo-location does not always give the town as a field of its own
      const fromAddress = place?.formattedAddress?.split(",")[1]?.replace(/\d+/g, "").trim();
      return place?.city ?? place?.district ?? place?.subregion ?? fromAddress ?? null;
    },
    enabled: latitude != null && longitude != null,
    staleTime: REVERSE_GEOCODE_STALE_TIME,
    // keep-comment: a missing permission fails every retry alike and only delays "location unknown"
    retry: false,
    placeholderData: keepPreviousData,
  });
}
