// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.Enums;

namespace WebDataContracts.ResponseModels.TrailImport;

// What applying a session would write, without writing any of it.
public class TrailImportDiffResponse
{
    public required int SessionId { get; set; }

    // False when the session cannot be applied; BlockedReason says why.
    public required bool CanApply { get; set; }
    public required string? BlockedReason { get; set; }

    public required int TrailsToCreate { get; set; }

    // Trails the merge would actually change a field or a route on. Not the same as the
    // number of trails the decisions land on: see TrailsLinked.
    public required int TrailsToUpdate { get; set; }

    // Trails the decisions attach a link to. On a first sync none of them can be written
    // to, so this is the figure that shows the run is doing something.
    public required int TrailsLinked { get; set; }

    public required int LinksToWrite { get; set; }
    public required int FeaturesExcluded { get; set; }
    public required int FeaturesSkipped { get; set; }

    // Undecided rows, which the apply phase leaves alone.
    public required int FeaturesPending { get; set; }

    // Decisions taken against a High or Certain match.
    public required IReadOnlyCollection<TrailImportDiffWarningResponse> AgainstStrongMatch { get; set; }

    // Trails that would be left with no Segment link, and so no geometry to merge from.
    public required IReadOnlyCollection<TrailImportDiffTrailResponse> WithoutSegment { get; set; }

    public static TrailImportDiffResponse Create(
        int sessionId,
        bool canApply,
        string? blockedReason,
        int trailsToCreate,
        int trailsToUpdate,
        int trailsLinked,
        int linksToWrite,
        int featuresExcluded,
        int featuresSkipped,
        int featuresPending,
        IEnumerable<TrailImportDiffWarningResponse> againstStrongMatch,
        IEnumerable<TrailImportDiffTrailResponse> withoutSegment)
    {
        return new TrailImportDiffResponse
        {
            SessionId = sessionId,
            CanApply = canApply,
            BlockedReason = blockedReason,
            TrailsToCreate = trailsToCreate,
            TrailsToUpdate = trailsToUpdate,
            TrailsLinked = trailsLinked,
            LinksToWrite = linksToWrite,
            FeaturesExcluded = featuresExcluded,
            FeaturesSkipped = featuresSkipped,
            FeaturesPending = featuresPending,
            AgainstStrongMatch = againstStrongMatch.ToList(),
            WithoutSegment = withoutSegment.ToList()
        };
    }
}
