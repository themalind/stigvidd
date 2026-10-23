// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  adminHikeSubmissionsApproveSubmission,
  adminHikeSubmissionsDeleteSubmissionImage,
  adminHikeSubmissionsGetSimilarRoutes,
  adminHikeSubmissionsGetSubmission,
  adminHikeSubmissionsGetSubmissions,
  adminHikeSubmissionsRejectSubmission,
  adminHikeSubmissionsUpdateSubmission,
  adminHikeSubmissionsUpdateSubmissionGeometry,
} from "./generated/admin-hike-submissions/admin-hike-submissions";
import type {
  AdminHikeSubmissionListItemResponse,
  AdminHikeSubmissionResponse,
  SimilarTrailResponse,
  UpdateHikeSubmissionRequest,
} from "./generated/model";

export type SimilarRoute = SimilarTrailResponse;

export type SubmissionListItem = AdminHikeSubmissionListItemResponse;
export type SubmissionDetail = AdminHikeSubmissionResponse;
export type SubmissionDetails = UpdateHikeSubmissionRequest;
export type SubmissionStatus = "Pending" | "Approved" | "Rejected";

export function getSubmissions(status: SubmissionStatus): Promise<SubmissionListItem[]> {
  return adminHikeSubmissionsGetSubmissions({ status });
}

export function getSubmission(identifier: string): Promise<SubmissionDetail> {
  return adminHikeSubmissionsGetSubmission(identifier);
}

export function getSimilarRoutes(identifier: string): Promise<SimilarRoute[]> {
  return adminHikeSubmissionsGetSimilarRoutes(identifier);
}

export function updateSubmission(identifier: string, details: SubmissionDetails): Promise<SubmissionDetail> {
  return adminHikeSubmissionsUpdateSubmission(identifier, details);
}

export function updateSubmissionGeometry(identifier: string, coordinates: string): Promise<SubmissionDetail> {
  return adminHikeSubmissionsUpdateSubmissionGeometry(identifier, { coordinates });
}

export function deleteSubmissionImage(identifier: string, imageIdentifier: string): Promise<unknown> {
  return adminHikeSubmissionsDeleteSubmissionImage(identifier, imageIdentifier);
}

export async function approveSubmission(identifier: string): Promise<string> {
  const approved = await adminHikeSubmissionsApproveSubmission(identifier);
  return approved.trailIdentifier;
}

export function rejectSubmission(identifier: string, reason: string): Promise<unknown> {
  return adminHikeSubmissionsRejectSubmission(identifier, { reason });
}
