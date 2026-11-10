// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { User, UserFavoritesTrail, UserWishlistTrail } from "@/data/types";
import { getValidAccessToken } from "@/services/keycloak-auth";
import { send, sendForJson } from "./core/request";

export async function getUserToken(): Promise<string | null> {
  return getValidAccessToken();
}

export function getStigViddUser(): Promise<User> {
  return sendForJson({ name: "getStigViddUser", path: "/users", endpoint: "/users" });
}

export function getUserFavorites(): Promise<UserFavoritesTrail[]> {
  return sendForJson({ name: "getUserFavorites", path: "/users/favorites", endpoint: "/users/favorites" });
}

export function getUserWishlist(): Promise<UserWishlistTrail[]> {
  return sendForJson({ name: "getUserWishlist", path: "/users/wishlist", endpoint: "/users/wishlist" });
}

export function addToUserFavorite(trailIdentifier: string): Promise<UserFavoritesTrail> {
  return sendForJson({
    name: "addToUserFavorite",
    method: "POST",
    path: "/users/favorites",
    endpoint: "/users/favorites",
    body: { trailIdentifier },
  });
}

export function addToUserWishlist(trailIdentifier: string): Promise<UserFavoritesTrail> {
  return sendForJson({
    name: "addToUserWishlist",
    method: "POST",
    path: "/users/wishlist",
    endpoint: "/users/wishlist",
    body: { trailIdentifier },
  });
}

export async function removeUserFavorite(trailIdentifier: string): Promise<void> {
  await send({
    name: "removeUserFavorite",
    method: "DELETE",
    path: `/users/favorites/${trailIdentifier}`,
    endpoint: "/users/favorites/{param}",
  });
}

export async function deleteStigViddUser(): Promise<void> {
  await send({ name: "deleteStigViddUser", method: "DELETE", path: "/users/delete", endpoint: "/users/delete" });
}

export async function removeUserWishlist(trailIdentifier: string): Promise<void> {
  await send({
    name: "removeUserWishlist",
    method: "DELETE",
    path: `/users/wishlist/${trailIdentifier}`,
    endpoint: "/users/wishlist/{param}",
  });
}
