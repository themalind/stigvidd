// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.TrailImport.Matching;
using Infrastructure.Enums;

namespace Core.TrailImport.Apply;

// One decided proposal, flattened to what the apply phase and its dry run need. The
// feature's geometry is read per row at write time, so it is not carried here.
public record ApplyPlanRow(
    int ProposalId,
    string FeatureName,
    string ExternalId,
    string GeometryFingerprint,
    ProposalDecision Decision,
    TrailSourceLinkRole Role,
    MatchConfidence Confidence,
    double CoverageForward,
    int? TargetTrailId,
    string? TargetTrailName,
    string? DecidedName,
    decimal? DecidedLengthKm);

// Everything the apply phase needs to decide before it writes anything.
public record ApplyPlan(
    IReadOnlyList<ApplyPlanRow> Rows,

    // Trails that already carry a Segment link for this source.
    IReadOnlySet<int> TrailsWithExistingSegment,

    // Trails that already have a link for this source. Without one there is no snapshot to
    // merge against, and no source-owned field may be written.
    IReadOnlySet<int> TrailsWithBaseline);
