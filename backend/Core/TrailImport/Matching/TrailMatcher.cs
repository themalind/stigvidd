// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.TrailImport.Matching;
using Infrastructure.Enums;
using NetTopologySuite.Geometries;

namespace Core.TrailImport.Matching;

// One trail to weigh a source feature against. Fingerprint is precomputed by the caller,
// which loads every trail once per import rather than per feature.
public sealed record TrailCandidate(int TrailId, string Fingerprint, LineString Geometry);

public sealed record TrailMatch(
    int? TrailId,
    // The closest trail the comparison looked at, set even when TrailId is null. Triage
    // only: it says what the coverage numbers were measured against, never a suggestion.
    int? NearestTrailId,
    MatchConfidence Confidence,
    double CoverageForward,
    double CoverageBackward,
    double? HausdorffMetres,
    string Reason,
    // The fingerprint the feature was matched on. Carried out so the proposal stores the
    // same value the matching used, instead of hashing the line a second time.
    string FeatureFingerprint);

// Decides which trail a source feature is, and how sure that is. Confidence drives what
// happens next: Certain and High update by themselves, anything lower waits for a human.
public static class TrailMatcher
{
    // How far a line may stray and still count as running along the other one.
    public const double ToleranceMetres = 15;

    private const double CertainCoverage = 0.95;
    private const double LikelyCoverage = 0.80;

    // Roughly 300 m at these latitudes. Only there to skip trails nowhere near the
    // feature before the expensive comparison; far wider than the tolerance needs.
    private const double EnvelopeSlackDegrees = 0.005;

    public static TrailMatch Match(LineString feature, IReadOnlyCollection<TrailCandidate> candidates) =>
        Match(feature, GeometryFingerprint.Compute(feature), candidates);

    // Takes the fingerprint from the caller, which computes it once per feature to look
    // the feature up among the excluded links before any trail is compared.
    public static TrailMatch Match(LineString feature, string fingerprint, IReadOnlyCollection<TrailCandidate> candidates)
    {
        ArgumentNullException.ThrowIfNull(feature);
        ArgumentNullException.ThrowIfNull(fingerprint);
        ArgumentNullException.ThrowIfNull(candidates);

        var identical = candidates.FirstOrDefault(c => c.Fingerprint == fingerprint);

        if (identical is not null)
            return new TrailMatch(identical.TrailId, identical.TrailId, MatchConfidence.Certain, 1, 1, 0, "identical geometry hash", fingerprint);

        var box = feature.EnvelopeInternal.Copy();
        box.ExpandBy(EnvelopeSlackDegrees);

        TrailCandidate? best = null;
        var bestComparison = default(GeometryComparison.Comparison);
        var bestScore = double.NegativeInfinity;

        foreach (var candidate in candidates)
        {
            if (!box.Intersects(candidate.Geometry.EnvelopeInternal))
                continue;

            var comparison = GeometryComparison.Compare(feature, candidate.Geometry, ToleranceMetres);

            // Mutual coverage decides, but forward coverage breaks ties, so a feature that
            // is a piece of a long trail picks that trail over an unrelated near neighbour.
            var score = Math.Min(comparison.CoverageForward, comparison.CoverageBackward)
                      + comparison.CoverageForward / 1000;

            if (score <= bestScore)
                continue;

            best = candidate;
            bestComparison = comparison;
            bestScore = score;
        }

        if (best is null)
            return new TrailMatch(null, null, MatchConfidence.Unmatched, 0, 0, null, "no trail nearby", fingerprint);

        var mutual = Math.Min(bestComparison.CoverageForward, bestComparison.CoverageBackward);

        // Deliberately no "same name" condition. 150 of the 177 geometry-matched trails
        // carry a different name in the source, because our names are edited by hand.
        if (mutual >= CertainCoverage)
            return Matched(best, bestComparison, MatchConfidence.High, fingerprint,
                $"{mutual:P0} mutual coverage within {ToleranceMetres:F0} m");

        if (mutual >= LikelyCoverage)
            return Matched(best, bestComparison, MatchConfidence.Medium, fingerprint,
                $"{mutual:P0} mutual coverage within {ToleranceMetres:F0} m");

        // The feature runs along the trail but covers only part of it: a stage being split
        // out of a longer trail, which is a Segment link rather than a new trail.
        if (bestComparison.CoverageForward >= LikelyCoverage)
            return Matched(best, bestComparison, MatchConfidence.Medium, fingerprint,
                $"{bestComparison.CoverageForward:P0} of the feature lies on the trail, but only {bestComparison.CoverageBackward:P0} of the trail on the feature");

        return new TrailMatch(null, best.TrailId, MatchConfidence.Unmatched,
            bestComparison.CoverageForward, bestComparison.CoverageBackward, bestComparison.HausdorffMetres,
            $"nearest trail covers only {mutual:P0}", fingerprint);
    }

    private static TrailMatch Matched(TrailCandidate candidate, GeometryComparison.Comparison comparison,
        MatchConfidence confidence, string fingerprint, string reason) =>
        new(candidate.TrailId, candidate.TrailId, confidence, comparison.CoverageForward, comparison.CoverageBackward,
            comparison.HausdorffMetres, reason, fingerprint);
}
