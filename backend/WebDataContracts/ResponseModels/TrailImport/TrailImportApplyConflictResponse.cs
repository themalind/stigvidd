// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.TrailImport;

public class TrailImportApplyConflictResponse
{
    public required int TrailId { get; set; }
    public required string TrailName { get; set; }
    public required string Field { get; set; }

    // keep-comment: what the trail kept, and what the source would have written over it
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
