// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Core.TrailImport.Apply;

// keep-comment: no geometry here; the apply reads it per row at write time
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
