// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { QueryClient } from "@tanstack/react-query";

export const hasReviewedTrailPrefix = (trailIdentifier: string) => ["review-exists", trailIdentifier];

// keep-comment: the trail carries the average rating, so it changes with any review
export function invalidateTrailReviews(queryClient: QueryClient, trailIdentifier: string) {
  void queryClient.invalidateQueries({ queryKey: ["trail", trailIdentifier] });
  void queryClient.invalidateQueries({ queryKey: ["reviews", trailIdentifier] });
  void queryClient.invalidateQueries({ queryKey: hasReviewedTrailPrefix(trailIdentifier) });
}
