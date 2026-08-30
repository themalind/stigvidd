// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  getTrailImportCreateSessionUrl,
  trailImportAnalyze,
  trailImportApply,
  trailImportDecide,
  trailImportDecideBulk,
  trailImportDeleteSession,
  trailImportGetDiff,
  trailImportGetPreview,
  trailImportGetProposals,
  trailImportGetSession,
  trailImportGetSessions,
} from "./generated/trail-import/trail-import";
import type {
  DecideProposalRequest,
  DecideProposalsBulkRequest,
  PagedResultOfTrailImportProposalResponse,
  TrailImportApplyResponse,
  TrailImportDiffResponse,
  TrailImportPreviewResponse,
  TrailImportProposalResponse,
  TrailImportSessionResponse,
} from "./generated/model";
import { customFetch } from "./mutator";

// Wrappers over the generated trail-import client, following the same convention as
// trail.ts: the generated models are looser than the UI needs, so responses are asserted
// back at this boundary. Auth and base URL come from the customFetch mutator.

export type Confidence = "Certain" | "High" | "Medium" | "Unmatched";
export type Decision = "Pending" | "Accept" | "Relink" | "CreateNew" | "Exclude" | "Skip";
/** What a linked feature contributes to the trail's route. */
export type LinkRole = "Segment" | "Duplicate" | "Excluded";
export type SessionStatus =
  | "Uploaded"
  | "Analyzing"
  | "AwaitingReview"
  | "Applying"
  | "Applied"
  | "Failed";

/** Ascending order of how much a human is needed. Drives sorting and the summary row. */
export const confidenceOrder: Confidence[] = ["Unmatched", "Medium", "High", "Certain"];

export type Proposal = TrailImportProposalResponse;
export type Session = TrailImportSessionResponse;
export type Preview = TrailImportPreviewResponse;
export type Diff = TrailImportDiffResponse;
export type ApplyResult = TrailImportApplyResponse;

/**
 * The generated multipart function expands IFormFile's own properties into form fields
 * instead of sending the file, so the body is built here — the same workaround trail.ts
 * uses for image uploads.
 */
export async function createSession(file: File, source?: string): Promise<Session> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  if (source) formData.append("source", source);

  return customFetch<Session>(getTrailImportCreateSessionUrl(), {
    method: "POST",
    body: formData,
  });
}

/** Refuses when decisions would be discarded, unless force says to run it anyway. */
export async function analyzeSession(sessionId: number, force = false): Promise<Session> {
  return trailImportAnalyze(sessionId, { force });
}

/** What applying the session would write, without writing any of it. */
export async function getDiff(sessionId: number): Promise<Diff> {
  return trailImportGetDiff(sessionId);
}

/** The destructive one: writes the decisions to Trails and their source links. */
export async function applySession(sessionId: number): Promise<ApplyResult> {
  return trailImportApply(sessionId);
}

export async function getSessions(): Promise<Session[]> {
  return trailImportGetSessions();
}

export async function getSession(sessionId: number): Promise<Session> {
  return trailImportGetSession(sessionId);
}

export async function deleteSession(sessionId: number): Promise<void> {
  await trailImportDeleteSession(sessionId);
}

export async function getProposals(
  sessionId: number,
  params: { confidence?: Confidence; decision?: Decision; page?: number; pageSize?: number },
): Promise<PagedResultOfTrailImportProposalResponse> {
  return trailImportGetProposals(sessionId, params);
}

export async function getPreview(sessionId: number, proposalId: number): Promise<Preview> {
  return trailImportGetPreview(sessionId, proposalId);
}

export async function decideProposal(
  sessionId: number,
  proposalId: number,
  request: DecideProposalRequest,
): Promise<void> {
  await trailImportDecide(sessionId, proposalId, request);
}

export async function decideBulk(
  sessionId: number,
  request: DecideProposalsBulkRequest,
): Promise<number> {
  const result = await trailImportDecideBulk(sessionId, request);

  return result.decided;
}
