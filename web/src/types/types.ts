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

export type VisitorInformation = {
  identifier: string;
  gettingThere: string;
  publicTransport: string;
  parking: string;
  illumination: boolean;
  illuminationText: string;
  maintainedBy: string;
  winterMaintenance: boolean;
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
  latitude: number;
  longitude: number;
};

/** An item in the media library — a processed image plus the object it is attached to. */
export type MediaItemResponse = {
  identifier: string;
  imageUrl: string;
  altText?: string | null;
  caption?: string | null;
  width: number;
  height: number;
  sizeBytes: number;
  /** "Trail" | "Facility" | "TrailSymbol" */
  ownerType: string;
  ownerIdentifier?: string | null;
  ownerName?: string | null;
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

export type TrailResponse = {
  identifier: string;
  name: string;
  trailLength: number;
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
  visitorInformation?: VisitorInformation;
  trailImagesResponse?: TrailImageResponse[];
};

export type TableColumn<T> = {
  label: string;
  key: keyof T;
  type: string;
  width?: number;
};

export type UpdateVisitorInformationRequest = {
  gettingThere?: string;
  publicTransport?: string;
  parking?: string;
  illumination?: boolean;
  illuminationText?: string;
  maintainedBy?: string;
  winterMaintenance?: boolean;
};

export type UpdateTrailRequest = {
  name: string;
  trailLength: number;
  classification?: number;
  accessibility?: boolean;
  accessibilityInfo?: string;
  trailSymbol?: string;
  description?: string;
  fullDescription?: string;
  tags?: string;
  city?: string;
  visitorInformation?: UpdateVisitorInformationRequest;
};

export const CLASSIFICATION: Record<number, string> = {
  0: "Unclassified",
  1: "Easy",
  2: "Medium",
  3: "Hard",
};

// ── mail templates ───────────────────────────────────────────────────────────
// Tightened from the generated models, which are looser than the UI needs (orval marks the
// value types optional/nullable). Asserted back to these in src/api/mail-templates.ts, which
// is the convention src/api/trail.ts documents.

export type MailTemplateToken = {
  name: string;
  label: string;
  description: string;
  sampleValue: string;
  isUsed: boolean;
};

export type MailTemplateListItem = {
  identifier: string;
  key: string;
  language: string;
  subject: string;
  description?: string | null;
  lastUpdatedAt: string;
  /** Whether any C# caller declares this key. False means nothing sends this row. */
  isKnown: boolean;
  /** Placeholders used that the caller does not supply. Any at all stops the mail. */
  unknownTokenCount: number;
  /** Placeholders supplied but unused. Renders fine; may mean a useless mail. */
  missingTokenCount: number;
};

export type MailTemplate = {
  identifier: string;
  key: string;
  language: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  description?: string | null;
  lastUpdatedAt: string;
  purpose?: string | null;
  /**
   * Whether any C# caller declares this key. NOT the same as `tokens` being empty: an
   * undeclared key has no token list because nothing knows what its caller passes, so nothing
   * in it may be called unknown. A declared key with no tokens means the opposite.
   */
  isKnown: boolean;
  tokens: MailTemplateToken[];
  unknownTokens: string[];
  missingTokens: string[];
};

export type UpdateMailTemplateRequest = {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  description?: string | null;
};

export type MailTemplatePreview = {
  subject: string;
  bodyHtml: string;
  bodyText: string;
};
