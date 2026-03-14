export type TrailShortInfoResponse = {
  identifier: string;
  name: string;
  trailLength: number;
  accessibility: boolean;
  classification: number;
  city: string;
  startLatitude?: number;
  startLongitude?: number;
};

export type TrailResponse = {
  identifier: string;
  name: string;
  trailLenght: number;
  classification: number;
  accessibility: boolean;
  accessibilityInfo: string;
  trailSymbol: string;
  trailSymbolImage: string;
  description: string;
  fullDescription: string;
  coordinates?: string;
  tags: string;
  createdBy: string;
  isVerified: boolean;
  city: string;
};

export type TableColumn<T> = {
  label: string;
  key: keyof T;
  type: string;
  width?: number;
};

export const CLASSIFICATION: Record<number, string> = {
  0: "Unclassified",
  1: "Easy",
  2: "Medium",
  3: "Hard",
};
