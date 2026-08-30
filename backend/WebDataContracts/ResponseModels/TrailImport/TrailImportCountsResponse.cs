// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.TrailImport;

// The summary row above the review list, and what tells the reviewer whether anything is
// left to do.
public class TrailImportCountsResponse
{
    public int Total { get; set; }
    public int Certain { get; set; }
    public int High { get; set; }
    public int Medium { get; set; }
    public int Unmatched { get; set; }
    public int Pending { get; set; }
    public int Accepted { get; set; }
    public int Relinked { get; set; }
    public int CreateNew { get; set; }
    public int Excluded { get; set; }
    public int Skipped { get; set; }

    public static TrailImportCountsResponse Create(
        int total,
        int certain,
        int high,
        int medium,
        int unmatched,
        int pending,
        int accepted,
        int relinked,
        int createNew,
        int excluded,
        int skipped)
    {
        return new TrailImportCountsResponse
        {
            Total = total,
            Certain = certain,
            High = high,
            Medium = medium,
            Unmatched = unmatched,
            Pending = pending,
            Accepted = accepted,
            Relinked = relinked,
            CreateNew = createNew,
            Excluded = excluded,
            Skipped = skipped
        };
    }
}
