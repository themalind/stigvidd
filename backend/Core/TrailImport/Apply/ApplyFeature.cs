// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;
using NetTopologySuite.Geometries;

namespace Core.TrailImport.Apply;

// keep-comment: heavier than ApplyPlanRow because it carries the geometry, so it is read only when a session is applied
public record ApplyFeature(
    int ProposalId,
    string ExternalId,
    string FeatureName,
    string GeometryFingerprint,
    string? FeatureProperties,
    LineString? FeatureGeometry,
    ProposalDecision Decision,
    TrailSourceLinkRole Role,
    MatchConfidence Confidence,
    int? TargetTrailId,
    string? DecidedName,
    decimal? DecidedLengthKm);
