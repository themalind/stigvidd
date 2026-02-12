using Infrastructure.Data;
using Infrastructure.Data.Entities;
using System.Globalization;
using System.Text.Json;
using Core.Enums;

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
                geometry.TryGetProperty("coordinates", out var coordinates) &&
                coordinates.ValueKind == JsonValueKind.Array)
            {
                var rawCoordinates = JsonSerializer.Deserialize<double[][]>(coordinates.ToString());
                coordinatesJson = rawCoordinates is null
                    ? null
                    : CleanCoordinates(rawCoordinates);
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
                Classification = (int)(properties.TryGetProperty("klassning", out var klassning)
                    ? ParseClassification(klassning.GetString())
                    : Classification.NotClassified),
                Accessibility = properties.TryGetProperty("tillganglighet", out var tillganglighet)
                    ? ParseAccessibility(tillganglighet.GetString())
                    : false, // eller default värde
                AccessibilityInfo = GetStringOrEmpty(properties, "tillg_text"),
                TrailSymbol = properties.TryGetProperty("sparmarkering", out var sparmarkering)
                    ? sparmarkering.GetString() ?? string.Empty
                    : string.Empty,
                TrailSymbolImage = string.Empty,
                Description = string.Empty,
                FullDescription = string.Empty,
                Coordinates = coordinatesJson,
                CreatedBy = "Borås Stad"
            };

            // Lägg till TrailLinks direkt innan save
            if (!string.IsNullOrWhiteSpace(linkValue) && linkValue != "-")
            {
                trail.TrailLinks = new List<TrailLink>
                {
                    new TrailLink
                    {
                        Link = linkValue,
                        Trail = trail,
                        Title = "Borås Stad"
                    }
                };
            }

            stigViddDbContext.Trails.Add(trail);
        }

        // Spara alla trails på en gång
        await stigViddDbContext.SaveChangesAsync(ct);
    }

    // Hjälpmetod för att konvertera sparlangd från "31,5 km" till double
    private decimal ParseTrailLength(string? lengthString)
    {
        if (string.IsNullOrWhiteSpace(lengthString))
            return 0;

        // Ta bort "km" och andra icke-numeriska tecken (utom komma/punkt)
        var cleaned = lengthString.Replace("km", "").Replace(" ", "").Trim();

        // Byt ut komma mot punkt för att hantera svensk decimalseparator
        cleaned = cleaned.Replace(",", ".");

        if (decimal.TryParse(cleaned, NumberStyles.Any, CultureInfo.InvariantCulture, out decimal result))
            return result;

        return 0;
    }

    private Classification ParseClassification(string? classification)
    {
        if (string.IsNullOrWhiteSpace(classification))
            return Classification.NotClassified;

        return classification.Trim().ToLowerInvariant() switch
        {
            "lätt" => Classification.Easy,
            "medel" => Classification.Medium,
            "svår" => Classification.Hard,
            _ => Classification.NotClassified
        };
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

    private string CleanCoordinates(double[][] jsonData)
    {
        try
        {
            var coordinates = jsonData.Select(c => new Coordinate
            {
                latitude = c[1],
                longitude = c[0]
            }).ToList();

            return JsonSerializer.Serialize(coordinates);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException("An error occurred while converting coordinates", ex);
        }
    }
}

internal class Coordinate
{
    public double latitude { get; set; }
    public double longitude { get; set; }
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