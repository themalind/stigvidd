// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

export type HikeSubmissionStatus = "Pending" | "Approved" | "Rejected";

export interface CreateHikeSubmissionRequest {
  hikeIdentifier: string;
  name: string;
  description: string;
  classification: number;
  gettingThere: string;
  parking?: string | null;
  publicTransport?: string | null;
  accessibilityInfo?: string | null;
  city: string;
  showSubmitterName: boolean;
  acceptTransfer: boolean;
  consentVersion: string;
  consentLocale: string;
  // keep-comment: inclusive indexes into the hike's coordinates; null keeps that end as recorded
  trimStartIndex?: number | null;
  trimEndIndex?: number | null;
  imageIdentifiers: string[];
}

export interface HikeSubmission {
  identifier: string;
  name: string;
  trailLength: number;
  status: HikeSubmissionStatus;
  rejectionReason?: string | null;
  createdAt: string;
  decidedAt?: string | null;
  sourceHikeIdentifier?: string | null;
  publishedTrailIdentifier?: string | null;
  likeCount: number;
  imageUrl?: string | null;
}
