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
  trailImageDTO?: TrailImage[];
  trailLinkDTO?: TrailLink[];
  reviewDTO?: Review[];
}

export interface TrailOverviewViewModel {
  identifier: string;
  name?: string;
  trailLength: number;
  trailImageDTOs?: TrailImage[];
}

export interface TrailImage {
  identifier: string;
  imageUrl: string;
  trailIdentifier: string;
}

export interface TrailLink {
  identifier: string;
  link: string;
  trailIdentifier: string;
}

export interface Review {
  identifier: string;
  trailReview?: string;
  grade: number;
  userName: string;
  createdAt: Date;
  userIdentifier: string;
  trailIdentifier: string;
  reviewImage?: ReviewImage[];
}

export interface ReviewImage {
  identifier: string;
  ImageUrl: string;
  reviewIdentifier: string;
}

export interface User {
  identifier: string;
  nickName: string;
  email: string;
}
