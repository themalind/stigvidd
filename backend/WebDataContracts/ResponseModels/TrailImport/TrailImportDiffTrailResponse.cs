// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.TrailImport;

public class TrailImportDiffTrailResponse
{
    public required int TrailId { get; set; }
    public required string TrailName { get; set; }
    public required int DuplicateLinks { get; set; }

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
