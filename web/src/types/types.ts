// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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

export type StigviddUser = {
  identifier: string;
  nickName: string;
  email: string;
};

/**
 * Authenticated identity derived from a Keycloak token. `id` is the `sub` claim.
 * Distinct from StigviddUser, which is the profile stored in our own database.
 */
export type AuthUser = {
  id: string;
  email: string;
  username: string;
};

export type TrailImageResponse = {
  identifier: string;
  imageUrl: string;
  altText?: string | null;
  caption?: string | null;
  width?: number;
  height?: number;
  sizeBytes?: number;
};

export type FacilityResponse = {
  identifier: string;
  name: string;
  facilityType: number;
  isAccessible: boolean;
  latitude?: number | null;
  longitude?: number | null;
};

/** Server-side processing knobs sent as multipart form fields alongside an upload. */
export type ImageProcessingOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  /** "original" | "jpeg" | "webp" | "png" */
  format?: string;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
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
