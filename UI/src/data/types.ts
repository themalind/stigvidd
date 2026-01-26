import { User as firebaseUser } from "firebase/auth";

// Response types
export interface Trail {
  identifier: string;
  name: string;
  trailLenght: number;
  classification: string;
  accessability: boolean;
  accessabilityInfo: string;
  trailSymbol: string;
  trailSymbolImage: string;
  description: string;
  coordinatesJson: string;
  trailImagesResponse?: TrailImage[];
  trailLinksResponse?: TrailLink[];
  reviewsResponse?: Review[];
}

export interface TrailOverview {
  identifier: string;
  name?: string;
  trailLength: number;
  trailImagesResponse?: TrailImage[];
}

export interface TrailImage {
  identifier: string;
  imageUrl: string;
}

export interface TrailLink {
  identifier: string;
  link: string;
}

export interface Review {
  identifier: string;
  trailReview?: string;
  grade: number;
  userName: string;
  createdAt: string;
  userIdentifier: string;
  trailIdentifier: string;
  reviewImages?: ReviewImage[];
}

export interface ReviewImage {
  identifier: string;
  imageUrl: string;
}

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

export interface RatingResponse {
  identifier: string;
  rating: number;
}

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface User {
  identifier: string;
  nickName: string;
  email: string;
  myWishList: UserWishlistTrail[];
  myFavorites: UserFavoritesTrail[];
}

// Frontend types
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

export interface CreateReviewRequest {
  review: string;
  grade: number;
  trailIdentifier: string;
  imageUris?: string[];
}

export interface DeleteReviewRequest {
  reviewIdentifier: string;
  userIdentifier: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  user: firebaseUser | null;
  error: { code: string; message: string } | null;
}
