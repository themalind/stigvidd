// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Diff, Preview, Proposal, Session } from "@/features/trail-import/api/trail-import";

export function proposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: 7,
    externalId: "102",
    featureName: "Knalleleden etapp 2",
    confidence: "High",
    coverageForward: 0.94,
    coverageBackward: 0.91,
    hausdorffMeters: 22,
    matchReason: "Runs along Knalleleden for 94% of its length",
    decision: "Pending",
    decidedRole: "Segment",
    suggestedTrailId: 3,
    suggestedTrailName: "Knalleleden",
    nearestTrailId: 3,
    nearestTrailName: "Knalleleden",
    decidedTrailId: null,
    decidedTrailName: null,
    decidedBy: null,
    decidedAt: null,
    note: null,
    decidedName: null,
    decidedLengthKm: null,
    ...overrides,
  };
}

export function preview(overrides: Partial<Preview> = {}): Preview {
  return {
    proposalId: 7,
    featureName: "Knalleleden etapp 2",
    confidence: "High",
    matchReason: null,
    coverageForward: 0.94,
    coverageBackward: 0.91,
    hausdorffMeters: 22,
    featureCoordinates: [
      [13, 57.7],
      [13.1, 57.7],
    ],
    featureLengthKm: 6.2,
    sourceStatedLengthKm: 6,
    sourceLengthDisagrees: false,
    trailCoordinates: [
      [13, 57.7],
      [13.1, 57.7],
    ],
    trailId: 3,
    trailIdentifier: "t-2",
    trailName: "Knalleleden",
    trailCuratedLengthKm: 42,
    trailMeasuredLengthKm: 42.1,
    trailIsVerified: true,
    trailIsNearestOnly: false,
    featureProperties: null,
    sharingTheTrail: [],
    ...overrides,
  };
}

export function session(overrides: Partial<Session> = {}): Session {
  return {
    id: 1,
    identifier: "session-1",
    source: "boras-stad",
    fileName: "boras-2026.geojson",
    fileHash: "abc",
    fileSizeBytes: 2048,
    status: "AwaitingReview",
    uploadedBy: "admin",
    createdAt: "2026-08-01T09:00:00Z",
    analyzedAt: "2026-08-01T09:05:00Z",
    appliedAt: null,
    featureCount: 203,
    errorMessage: null,
    counts: {
      total: 3,
      certain: 1,
      high: 1,
      medium: 1,
      unmatched: 0,
      pending: 3,
      accepted: 0,
      relinked: 0,
      createNew: 0,
      excluded: 0,
      skipped: 0,
    },
    applied: null,
    ...overrides,
  };
}

export function diff(overrides: Partial<Diff> = {}): Diff {
  return {
    sessionId: 1,
    canApply: true,
    blockedReason: null,
    trailsToCreate: 2,
    trailsToUpdate: 3,
    trailsLinked: 3,
    linksToWrite: 41,
    featuresExcluded: 1,
    featuresSkipped: 0,
    featuresPending: 0,
    againstStrongMatch: [],
    withoutSegment: [],
    ...overrides,
  };
}
