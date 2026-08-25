using System.Text.Json;

namespace Core.TrailImport.Apply;

// What an apply wrote, stored on the session so the run stays readable afterwards. Kept
// separate from the response contract because it is a database column: it outlives every
// shape the admin view happens to want today.
public record ApplyReport(
    int TrailsCreated,
    int TrailsUpdated,
    int LinksWritten,
    int FeaturesExcluded,
    IReadOnlyList<ApplyConflict> Conflicts,

    // Existing trails the decisions attached a link to. On a first sync every one of them
    // is linked without being changed, which is why TrailsUpdated can be zero and the run
    // still be the one that did the work. Null on a report written before the field
    // existed, which is not the same as none.
    int? TrailsLinked = null)
{
    public static ApplyReport None { get; } = new(0, 0, 0, 0, []);

    // An older session can carry a report this build no longer parses, and a report that
    // cannot be read is not a reason to fail the request that only wanted to see it.
    public static ApplyReport Read(string? stored)
    {
        if (string.IsNullOrWhiteSpace(stored))
            return None;

        try
        {
            return JsonSerializer.Deserialize<ApplyReport>(stored) ?? None;
        }
        catch (JsonException)
        {
            return None;
        }
    }
}
