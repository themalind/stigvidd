// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getAllTrails } from "@/api/trails";
import { TRAIL_LIST_STALE_TIME } from "@/constants/cache";
import { TrailShortInfoResponse } from "@/data/types";
import { useQuery } from "@tanstack/react-query";

export const useTrails = () => {
  return useQuery<TrailShortInfoResponse[]>({
    queryKey: ["trailList", "trailsWithShortInfo"],
    queryFn: getAllTrails,

    staleTime: TRAIL_LIST_STALE_TIME,
    gcTime: TRAIL_LIST_STALE_TIME, // keep in cache as long as it stays fresh

    // Show cached data immediately while refetching in background
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
};
