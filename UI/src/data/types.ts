export interface Trail {
  id: string;
  name: string;
  trailLenght: string;
  classification: string;
  accessability: boolean;
  accessabilityInfo: string;
  trailSymbol: string;
  trailSymbolImage: string;
  trailImages?: TrailImage[];
  description: string;
  coordinates: string;
}

export interface TrailImage {
  id: string;
  imageUrl: string;
  trailId: string;
}

export interface TrailLink {
  id: string;
  link: string;
  trailId: string;
}

export interface Review {
  id: string;
  review: string;
  grade: number;
  trailId: string;
  userId: string;
}

export interface ReviewImage {
  id: string;
  ImageUrl: string;
  reviewId: string;
}

export interface User {
  id: string;
  nickName: string;
  email: string;
}
