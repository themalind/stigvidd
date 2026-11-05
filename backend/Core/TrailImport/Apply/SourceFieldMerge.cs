// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.TrailImport.Matching;
namespace Core.TrailImport.Apply;

/// <summary>
/// Merges one source-owned field across three values: what the source said last time
/// (the baseline, out of TrailSourceLink.SourceSnapshot), what the trail says now, and
/// what the source says today.
/// </summary>
public static class SourceFieldMerge
{
    /// <param name="hasBaseline">
    /// False on the first sync for a trail, when no snapshot has ever been stored. Every
    /// field then looks unedited, so nothing may be written.
    /// </param>
    public static MergeResult<T> Merge<T>(
        bool hasBaseline, T baseline, T ours, T theirs, IEqualityComparer<T>? comparer = null)
    {
        comparer ??= EqualityComparer<T>.Default;

        if (!hasBaseline)
            return new MergeResult<T>(MergeOutcome.NoBaseline, ours);

        if (comparer.Equals(ours, theirs))
            return new MergeResult<T>(MergeOutcome.Unchanged, ours);

        // The source stands still: whatever the trail says is a local edit, and it stays.
        if (comparer.Equals(baseline, theirs))
            return new MergeResult<T>(MergeOutcome.KeptOurs, ours);

        // We never touched it, so there is nothing of ours to lose.
        if (comparer.Equals(baseline, ours))
            return new MergeResult<T>(MergeOutcome.TookSource, theirs);

        return new MergeResult<T>(MergeOutcome.Conflict, ours);
    }
}
