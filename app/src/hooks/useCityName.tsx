// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";

// Reverse-geocodes a position into a place name, or null when the geocoder has nothing
// to offer. Returning null rather than a fallback string keeps the wording (and its
// translation) in the component that renders it — this hook has no business inventing
// user-facing copy.
//
// Both arguments are optional and the query stays disabled without them: expo-location
// requires foreground permission for reverse geocoding, so calling it with a stand-in
// coordinate would either name the wrong town or throw.
export function useCityName(latitude?: number, longitude?: number) {
  return useQuery<string | null>({
    queryKey: ["reverseGeocode", latitude, longitude],
    queryFn: async () => {
      const [place] = await Location.reverseGeocodeAsync({ latitude: latitude!, longitude: longitude! });
      // Fullösning, Expo location har inte stadsnamnet som en egen variabel i jsondatan.
      const fromAddress = place?.formattedAddress?.split(",")[1]?.replace(/\d+/g, "").trim();
      return place?.city ?? place?.district ?? place?.subregion ?? fromAddress ?? null;
    },
    enabled: latitude != null && longitude != null,
    staleTime: 1000 * 60 * 10,
    // A missing permission fails every attempt identically; retrying just delays the
    // point at which the banner can settle on its "location unknown" wording.
    retry: false,
    placeholderData: keepPreviousData,
  });
}
