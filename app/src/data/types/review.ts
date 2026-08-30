// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

export interface Review {
  identifier: string;
  trailReview?: string;
  rating: number;
  // Both null once the author has deleted their account.
  userName: string | null;
  createdAt: string;
  userIdentifier: string | null;
  trailIdentifier: string;
  reviewImages?: ReviewImage[];
}

export interface ReviewImage {
  identifier: string;
  imageUrl: string;
}

export interface RatingResponse {
  identifier: string;
  rating: number;
}

export interface PagedReviewResponse {
  reviews: Review[];
  hasMore: boolean;
  page: number;
  total?: number;
}

export interface CreateReviewRequest {
  review: string;
  rating: number;
  trailIdentifier: string;
  imageUris?: string[];
}

export interface DeleteReviewRequest {
  reviewIdentifier: string;
  userIdentifier: string;
}
