import { RatingResponse } from "./review";
import { TrailImage } from "./trail";

export interface UserFavoritesTrail {
  identifier: string;
  name: string;
  trailLength: number;
  description: string;
  ratingResponse?: RatingResponse[];
  trailImages?: TrailImage[];
}

export interface UserWishlistTrail {
  identifier: string;
  name: string;
  trailLength: number;
  description: string;
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

export interface CreateStigViddUserCredentials {
  email: string;
  nickname: string;
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
