export interface Trail {
  identifier: string;
  name: string;
  trailLenght: number;
  classification: string;
  accessability: boolean;
  accessabilityInfo: string;
  trailSymbol: string;
  trailSymbolImage: string;
  trailImageDTO?: TrailImage[];
  trailLinkDTO?: TrailLink[];
  reviewDTO?: Review[];
  description: string;
  coordinatesJson: string;
}

export interface TrailOverviewViewModel {
  identifier: string;
  name: string;
  trailLength: number;
  trailImageDTOs?: TrailImage[];
}

export interface TrailImage {
  identifier: string;
  imageUrl: string;
  trailId: string;
}

export interface TrailLink {
  identifier: string;
  link: string;
  trailId: string;
}

export interface Review {
  identifier: string;
  review: string;
  grade: number;
  trailId: string;
  userId: string;
  reviewImage: ReviewImage[];
}

export interface ReviewImage {
  identifier: string;
  ImageUrl: string;
  reviewId: string;
}

export interface User {
  identifier: string;
  nickName: string;
  email: string;
}
