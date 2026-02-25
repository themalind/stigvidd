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

export type TableColumn<T> = {
  label: string;
  key: keyof T;
  type: string;
  width?: number;
};
