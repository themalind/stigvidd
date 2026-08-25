using System.Text.Json;

namespace Core.TrailImport.Source;

// The fields the source owns, read out of one feature's stored properties. Name and
// length are deliberately absent: both are ours, and a new trail takes them from the
// reviewer instead.
public sealed record SourceTrailFields(
    int Classification,
    bool Accessibility,
    string AccessibilityInfo,
    string TrailSymbol)
{
    // What a feature with no properties, or unreadable ones, contributes: nothing.
    public static SourceTrailFields None { get; } = new(0, false, string.Empty, string.Empty);

    /// <summary>
    /// Reads one feature's properties as the source published them. A missing key reads
    /// as its default, which is what a three-way merge needs: the baseline and today's
    /// value have to be comparable even when the source stopped sending a field.
    /// </summary>
    public static SourceTrailFields Read(string? propertiesJson)
    {
        if (string.IsNullOrWhiteSpace(propertiesJson))
            return None;

        try
        {
            using var document = JsonDocument.Parse(propertiesJson);
            var properties = document.RootElement;

            if (properties.ValueKind != JsonValueKind.Object)
                return None;

            return new SourceTrailFields(
                ParseClassification(ReadString(properties, "klassning")),
                ReadString(properties, "tillganglighet").Equals("JA", StringComparison.OrdinalIgnoreCase),
                ReadString(properties, "tillg_text"),
                ReadString(properties, "sparmarkering"));
        }
        catch (JsonException)
        {
            return None;
        }
    }

    private static int ParseClassification(string value) => (int)(value.Trim().ToLowerInvariant() switch
    {
        "lätt" => Infrastructure.Enums.Classification.Easy,
        "medel" => Infrastructure.Enums.Classification.Medium,
        "svår" => Infrastructure.Enums.Classification.Hard,
        _ => Infrastructure.Enums.Classification.NotClassified,
    });

    // The source writes klassning and tillg_text as null as often as it writes them at all.
    private static string ReadString(JsonElement properties, string name) =>
        properties.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? string.Empty
            : string.Empty;
}
