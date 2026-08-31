// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { RatingResponse } from "./review";
import { TrailImage } from "./trail";

export interface UserFavoritesTrail {
  identifier: string;
  name: string;
  trailLength: number;
  city: string;
  classification: number;
  accessibility: boolean;
  startLatitude?: number;
  startLongitude?: number;
  ratingResponse?: RatingResponse[];
  trailImages?: TrailImage[];
}

export interface UserWishlistTrail {
  identifier: string;
  name: string;
  trailLength: number;
  city: string;
  classification: number;
  accessibility: boolean;
  startLatitude?: number;
  startLongitude?: number;
  ratingResponse?: RatingResponse[];
  trailImages?: TrailImage[];
}

export interface User {
  identifier: string;
  nickName: string;
  email: string;
  myWishList: UserWishlistTrail[];
  myFavorites: UserFavoritesTrail[];
}

/**
 * Authenticated identity derived from a Keycloak token.
 * `id` is the Keycloak `sub` claim. Distinct from `User`, which is the
 * StigVidd profile stored in our own database.
 */
export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

export interface UserName {
  identifier: string;
  nickName: string;
}

export interface RegisterData {
  nickName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface UpdateUserResult {
  success: boolean;
  error: { code: string; message: string } | null;
}
