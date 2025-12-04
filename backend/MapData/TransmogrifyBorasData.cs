using Infrastructure.Data;
using Infrastructure.Data.Entities;
using System.Globalization;
using System.Text.Json;

namespace MapData;

internal class TransmogrifyBorasData
{
    private readonly StigViddDbContext stigViddDbContext;

    public TransmogrifyBorasData(StigViddDbContext stigViddDbContext)
    {
        this.stigViddDbContext = stigViddDbContext;
    }

    public async Task TransmogrifyAsync(string pathName, CancellationToken ct)
    {
        // Hämta filinnehåll från angiven plats
        using var stream = File.OpenRead(pathName);
        // Parse JSON
        using var parsedJSON = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        // Hämta root-elementet
        var root = parsedJSON.RootElement;
        // Hämta features-arrayen
        var features = root.GetProperty("features");

        // Gå igenom varje element i features-arrayen
        foreach (var feature in features.EnumerateArray())
        {
            // Säker hämtning av properties
            if (!feature.TryGetProperty("properties", out var properties) ||
                properties.ValueKind != JsonValueKind.Object)
            {
                continue; // Hoppa över features utan properties
            }

            // Säker hämtning av coordinates från geometry
            string? coordinatesJson = null;
            if (feature.TryGetProperty("geometry", out var geometry) &&
                geometry.ValueKind == JsonValueKind.Object &&
                geometry.TryGetProperty("coordinates", out var coordinates))
            {
                coordinatesJson = coordinates.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null
                    ? null
                    : coordinates.ToString();
            }

            // Hämta länk för TrailLink
            var linkValue = GetStringOrEmpty(properties, "link");

            // Skapa Trail-objektet - säkra alla GetProperty-anrop
            var trail = new Trail
            {
                Name = properties.TryGetProperty("namn", out var namn)
                    ? namn.GetString() ?? string.Empty
                    : string.Empty,
                TrailLength = properties.TryGetProperty("sparlangd", out var sparlangd)
                    ? ParseTrailLength(sparlangd.GetString())
                    : 0,
                Classification = properties.TryGetProperty("klassning", out var klassning)
                    ? klassning.GetString() ?? string.Empty
                    : string.Empty,
                Accessability = properties.TryGetProperty("tillganglighet", out var tillganglighet)
                    ? ParseAccessibility(tillganglighet.GetString())
                    : false, // eller default värde
                AccessabilityInfo = GetStringOrEmpty(properties, "tillg_text"),
                TrailSymbol = properties.TryGetProperty("sparmarkering", out var sparmarkering)
                    ? sparmarkering.GetString() ?? string.Empty
                    : string.Empty,
                TrailSymbolImage = string.Empty,
                Description = string.Empty,
                CoordinatesJson = coordinatesJson
            };

            // Lägg till TrailLinks direkt innan save
            if (!string.IsNullOrWhiteSpace(linkValue) && linkValue != "-")
            {
                trail.TrailLinks = new List<TrailLink>
            {
                new TrailLink
                {
                    Link = linkValue,
                    Trail = trail
                }
            };
            }

            stigViddDbContext.Trails.Add(trail);
        }

        // Spara alla trails på en gång
        await stigViddDbContext.SaveChangesAsync(ct);
    }

    // Hjälpmetod för att konvertera sparlangd från "31,5 km" till double
    private double ParseTrailLength(string? lengthString)
    {
        if (string.IsNullOrWhiteSpace(lengthString))
            return 0;

        // Ta bort "km" och andra icke-numeriska tecken (utom komma/punkt)
        var cleaned = lengthString.Replace("km", "").Replace(" ", "").Trim();

        // Byt ut komma mot punkt för att hantera svensk decimalseparator
        cleaned = cleaned.Replace(",", ".");

        if (double.TryParse(cleaned, NumberStyles.Any, CultureInfo.InvariantCulture, out double result))
            return result;

        return 0;
    }

    // Hjälpmetod för att konvertera tillgänglighet från "NEJ"/"JA" till bool
    private bool ParseAccessibility(string? accessString)
    {
        if (string.IsNullOrWhiteSpace(accessString))
            return false;

        return accessString.Equals("JA", StringComparison.OrdinalIgnoreCase);
    }

    // Hjälpmetod för att hantera null-värden i JSON
    private string GetStringOrEmpty(JsonElement properties, string propertyName)
    {
        if (properties.TryGetProperty(propertyName, out var property) &&
            property.ValueKind != JsonValueKind.Null)
        {
            return property.GetString() ?? string.Empty;
        }
        return string.Empty;
    }
}

/*
 {
"type": "FeatureCollection",
  "name": "spar_leder",
  "features": [
  {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": []
    },
      "properties": {
        "id": 4456,
        "namn": "Dannike motionsspår",
        "link": "https://www.boras.se/5.380b669a18f0f735521738.html",
        "sparlangd": "2,3 km",
        "klassning": null,
        "sparmarkering": "Omarkerad",
        "tillganglighet": "NEJ",
        "tillg_text": null
      }

]
}
 */