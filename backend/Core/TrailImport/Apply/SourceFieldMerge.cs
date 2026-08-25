using Core.TrailImport.Matching;
namespace Core.TrailImport.Apply;

// What a three-way merge decided for one field.
public enum MergeOutcome
{
    NoBaseline,  // no previous snapshot; nothing is written on an existing trail
    Unchanged,   // ours and the source already agree
    TookSource,  // we had not edited the field, so the source's new value wins
    KeptOurs,    // the source did not change, so our edit stands
    Conflict,    // both changed; ours stands and the difference is reported
}

public readonly record struct MergeResult<T>(MergeOutcome Outcome, T Value)
{
    // True when the caller has to write Value back. Every other outcome leaves the row alone.
    public bool ShouldWrite => Outcome == MergeOutcome.TookSource;
}

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
