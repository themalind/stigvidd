// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.TrailImport;

// What applying a session actually wrote. The same figures are stored on the session as
// its apply report, so the run stays readable long after the response is gone.
public class TrailImportApplyResponse
{
    public required int SessionId { get; set; }
    public required string Status { get; set; }
    public DateTime? AppliedAt { get; set; }

    public int TrailsCreated { get; set; }
    public int TrailsUpdated { get; set; }
    public int LinksWritten { get; set; }
    public int FeaturesExcluded { get; set; }

    // Existing trails the decisions linked to. TrailsUpdated counts the subset that also
    // changed, which on a first sync is none of them. Null on a session applied before
    // this figure was recorded.
    public int? TrailsLinked { get; set; }

    // Source-owned fields where both sides had changed. Ours stands; these are for a human
    // to look at.
    public required IReadOnlyCollection<TrailImportApplyConflictResponse> Conflicts { get; set; }

    public static TrailImportApplyResponse Create(
        int sessionId,
        string status,
        DateTime? appliedAt,
        int trailsCreated,
        int trailsUpdated,
        int linksWritten,
        int featuresExcluded,
        int? trailsLinked,
        IEnumerable<TrailImportApplyConflictResponse> conflicts)
    {
        return new TrailImportApplyResponse
        {
            SessionId = sessionId,
            Status = status,
            AppliedAt = appliedAt,
            TrailsCreated = trailsCreated,
            TrailsUpdated = trailsUpdated,
            LinksWritten = linksWritten,
            FeaturesExcluded = featuresExcluded,
            TrailsLinked = trailsLinked,
            Conflicts = conflicts.ToList()
        };
    }
}

public class TrailImportApplyConflictResponse
{
    public required int TrailId { get; set; }
    public required string TrailName { get; set; }
    public required string Field { get; set; }

    // What the trail kept, and what the source would have written over it.
    public required string Ours { get; set; }
    public required string Theirs { get; set; }

    public static TrailImportApplyConflictResponse Create(
        int trailId, string trailName, string field, string ours, string theirs)
    {
        return new TrailImportApplyConflictResponse
        {
            TrailId = trailId,
            TrailName = trailName,
            Field = field,
            Ours = ours,
            Theirs = theirs
        };
    }
}
