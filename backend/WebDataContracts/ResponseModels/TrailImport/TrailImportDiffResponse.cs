// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.TrailImport;

// What applying a session would write, without writing any of it.
public class TrailImportDiffResponse
{
    public required int SessionId { get; set; }

    // False when the session cannot be applied; BlockedReason says why.
    public bool CanApply { get; set; }
    public string? BlockedReason { get; set; }

    public int TrailsToCreate { get; set; }

    // Trails the merge would actually change a field or a route on. Not the same as the
    // number of trails the decisions land on: see TrailsLinked.
    public int TrailsToUpdate { get; set; }

    // Trails the decisions attach a link to. On a first sync none of them can be written
    // to, so this is the figure that shows the run is doing something.
    public int TrailsLinked { get; set; }

    public int LinksToWrite { get; set; }
    public int FeaturesExcluded { get; set; }
    public int FeaturesSkipped { get; set; }

    // Undecided rows, which the apply phase leaves alone.
    public int FeaturesPending { get; set; }

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

public class TrailImportDiffWarningResponse
{
    public required int ProposalId { get; set; }
    public required string FeatureName { get; set; }
    public required string Decision { get; set; }
    public required string Confidence { get; set; }
    public double CoverageForward { get; set; }
    public string? TrailName { get; set; }

    public static TrailImportDiffWarningResponse Create(
        int proposalId,
        string featureName,
        string decision,
        string confidence,
        double coverageForward,
        string? trailName)
    {
        return new TrailImportDiffWarningResponse
        {
            ProposalId = proposalId,
            FeatureName = featureName,
            Decision = decision,
            Confidence = confidence,
            CoverageForward = coverageForward,
            TrailName = trailName
        };
    }
}

public class TrailImportDiffTrailResponse
{
    public required int TrailId { get; set; }
    public required string TrailName { get; set; }
    public int DuplicateLinks { get; set; }

    public static TrailImportDiffTrailResponse Create(int trailId, string trailName, int duplicateLinks)
    {
        return new TrailImportDiffTrailResponse
        {
            TrailId = trailId,
            TrailName = trailName,
            DuplicateLinks = duplicateLinks
        };
    }
}
