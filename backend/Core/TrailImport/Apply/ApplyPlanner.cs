// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.TrailImport.Source;
using Infrastructure.Enums;
using NetTopologySuite.Geometries;
using NetTopologySuite.Operation.Linemerge;

namespace Core.TrailImport.Apply;

// Works out everything an apply will write, without writing any of it. Pure, so the rules
// that decide what a sync may overwrite are testable on their own and the repository is
// left with nothing but the transaction.
public static class ApplyPlanner
{
    // The decisions that reach the database. Pending and Skip are left where they are.
    private static readonly ProposalDecision[] Written =
    [
        ProposalDecision.Accept,
        ProposalDecision.Relink,
        ProposalDecision.CreateNew,
        ProposalDecision.Exclude,
    ];

    public static ApplyWriteSet Plan(ApplyInput input)
    {
        ArgumentNullException.ThrowIfNull(input);

        var features = input.Features.Where(f => Written.Contains(f.Decision)).ToList();

        var creates = features
            .Where(f => f.Decision == ProposalDecision.CreateNew && f.FeatureGeometry is not null)
            .Select(Create)
            .ToList();

        var links = features
            .Select(f => Link(f, input.LinksByFingerprint))
            .ToList();

        var conflicts = new List<ApplyConflict>();
        var updates = new List<TrailUpdate>();

        // Accept and Relink land on trails that already exist, and several features can land
        // on the same one, so it is updated once.
        foreach (var group in features
            .Where(f => f.Decision is ProposalDecision.Accept or ProposalDecision.Relink && f.TargetTrailId is not null)
            .GroupBy(f => f.TargetTrailId!.Value))
        {
            if (!input.Targets.TryGetValue(group.Key, out var target))
                continue;

            var update = Update([.. group], target, input, conflicts);

            if (!update.IsEmpty)
                updates.Add(update);
        }

        return new ApplyWriteSet(creates, updates, links, conflicts);
    }

    private static TrailCreate Create(ApplyFeature feature)
    {
        var source = SourceTrailFields.Read(feature.FeatureProperties);
        var geometry = feature.FeatureGeometry!;

        return new TrailCreate(
            feature.ProposalId,
            // The reviewer names a new trail; the source's name is only what the panel was
            // pre-filled with.
            string.IsNullOrWhiteSpace(feature.DecidedName) ? feature.FeatureName : feature.DecidedName.Trim(),
            feature.DecidedLengthKm ?? TrailLength.FromGeometry(geometry),
            geometry,
            source.Classification,
            source.Accessibility,
            source.AccessibilityInfo,
            source.TrailSymbol);
    }

    private static LinkWrite Link(ApplyFeature feature, IReadOnlyDictionary<string, ApplyBaseline> existing)
    {
        existing.TryGetValue(feature.GeometryFingerprint, out var baseline);

        return new LinkWrite(
            baseline?.LinkId,
            feature.GeometryFingerprint,
            feature.ExternalId,
            feature.Decision is ProposalDecision.Accept or ProposalDecision.Relink ? feature.TargetTrailId : null,
            feature.Decision == ProposalDecision.CreateNew ? feature.ProposalId : null,
            feature.Decision switch
            {
                ProposalDecision.Exclude => TrailSourceLinkRole.Excluded,
                ProposalDecision.CreateNew => TrailSourceLinkRole.Segment,
                _ => feature.Role,
            },
            feature.Confidence,
            // Today's properties are the baseline the next sync merges against.
            feature.FeatureProperties,
            // Every decision that reaches an apply traces back to a reviewer, including the
            // exclusions the analysis carries forward from an earlier import.
            true);
    }

    private static TrailUpdate Update(
        IReadOnlyList<ApplyFeature> onTrail,
        ApplyTarget target,
        ApplyInput input,
        List<ApplyConflict> conflicts)
    {
        // Whichever feature carries the route speaks for the trail. A Duplicate belongs to
        // it but describes something else, so its properties are not what the trail's own
        // fields are merged from.
        var carrier = onTrail
            .OrderBy(f => f.Role == TrailSourceLinkRole.Segment ? 0 : 1)
            .ThenBy(f => f.ProposalId)
            .First();

        input.LinksByFingerprint.TryGetValue(carrier.GeometryFingerprint, out var link);

        // Two gates, and they answer different questions. The trail one is the first-sync
        // rule: a trail the source has never been recorded against has no way to tell a
        // local edit from what the original import left. The snapshot one is the merge's
        // own: without it there is nothing to compare against.
        var hasBaseline = input.TrailsWithBaseline.Contains(target.TrailId)
            && link?.SourceSnapshot is not null;

        var baseline = SourceTrailFields.Read(link?.SourceSnapshot);
        var ours = new SourceTrailFields(
            target.Classification, target.Accessibility, target.AccessibilityInfo, target.TrailSymbol);
        var theirs = SourceTrailFields.Read(carrier.FeatureProperties);

        var classification = SourceFieldMerge.Merge(
            hasBaseline, baseline.Classification, ours.Classification, theirs.Classification);
        var accessibility = SourceFieldMerge.Merge(
            hasBaseline, baseline.Accessibility, ours.Accessibility, theirs.Accessibility);
        var accessibilityInfo = SourceFieldMerge.Merge(
            hasBaseline, baseline.AccessibilityInfo, ours.AccessibilityInfo, theirs.AccessibilityInfo, StringComparer.Ordinal);
        var symbol = SourceFieldMerge.Merge(
            hasBaseline, baseline.TrailSymbol, ours.TrailSymbol, theirs.TrailSymbol, StringComparer.Ordinal);

        Report("Classification", classification, theirs.Classification);
        Report("Accessibility", accessibility, theirs.Accessibility);
        Report("AccessibilityInfo", accessibilityInfo, theirs.AccessibilityInfo);
        Report("TrailSymbol", symbol, theirs.TrailSymbol);

        void Report<T>(string field, MergeResult<T> result, T source)
        {
            if (result.Outcome == MergeOutcome.Conflict)
                conflicts.Add(new ApplyConflict(
                    target.TrailId, target.Name, field, $"{result.Value}", $"{source}"));
        }

        return new TrailUpdate(
            target.TrailId,
            // DecidedLengthKm is the only route into TrailLength: the length is ours, so the
            // source never writes it and it is not merged.
            onTrail.Select(f => f.DecidedLengthKm).FirstOrDefault(l => l is not null),
            classification.ShouldWrite ? classification.Value : null,
            accessibility.ShouldWrite ? accessibility.Value : null,
            accessibilityInfo.ShouldWrite ? accessibilityInfo.Value : null,
            symbol.ShouldWrite ? symbol.Value : null,
            GeoPath(onTrail, target, input.TrailsWithBaseline.Contains(target.TrailId)));
    }

    /// <summary>
    /// The trail's route, derived from its Segment features rather than merged: geometry is
    /// a result of the links, not a value anyone set. A trail whose features are all
    /// Duplicate keeps the line it has, which is how curated geometry stays protected.
    /// Null when the derivation comes out as what the trail already stores, so an apply
    /// that changes no route writes no route.
    /// </summary>
    private static LineString? GeoPath(
        IReadOnlyList<ApplyFeature> onTrail, ApplyTarget target, bool hasBaseline)
    {
        if (!hasBaseline)
            return null;

        var segments = onTrail
            .Where(f => f.Role == TrailSourceLinkRole.Segment && f.FeatureGeometry is not null)
            .Select(f => f.FeatureGeometry!)
            .ToList();

        if (segments.Count == 0)
            return null;

        var derived = segments.Count == 1 ? segments[0] : Merge(segments);

        return derived is null || (target.GeoPath is not null && derived.EqualsExact(target.GeoPath))
            ? null
            : derived;
    }

    private static LineString? Merge(IReadOnlyList<LineString> segments)
    {
        var merger = new LineMerger();

        foreach (var segment in segments)
            merger.Add(segment);

        var merged = merger.GetMergedLineStrings().OfType<LineString>().ToList();

        // Segments that do not join end to end come back as several lines, and a trail
        // stores one. Leaving the route alone is the safe half of that.
        return merged.Count == 1 ? GeoPointFactory.FromLonLatPath(merged[0].Coordinates) : null;
    }
}
