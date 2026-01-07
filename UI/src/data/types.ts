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
  createdAt: Date;
  userIdentifier: string;
  trailIdentifier: string;
  reviewImagesResponse?: ReviewImage[];
}

export interface ReviewImage {
  identifier: string;
  ImageUrl: string;
}

export interface User {
  identifier: string;
  nickName: string;
  email: string;
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