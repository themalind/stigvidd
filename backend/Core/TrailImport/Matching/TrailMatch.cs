// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Core.TrailImport.Matching;

public sealed record TrailMatch(
    int? TrailId,
    // keep-comment: the closest trail compared, set even when TrailId is null; triage only, never a suggestion
    int? NearestTrailId,
    MatchConfidence Confidence,
    double CoverageForward,
    double CoverageBackward,
    double? HausdorffMetres,
    string Reason,
    // keep-comment: carried out so the proposal stores the fingerprint the matching used instead of hashing again
    string FeatureFingerprint);
