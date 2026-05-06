using CsvHelper;
using CsvHelper.Configuration;
using CsvHelper.Configuration.Attributes;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using System.Globalization;

namespace MapData;

internal class FacilityImporter
{
    private readonly StigViddDbContext _stigViddDbContext;

    public FacilityImporter(StigViddDbContext stigViddDbContext)
    {
        _stigViddDbContext = stigViddDbContext;
    }

    public async Task ImportAsync(string pathName, CancellationToken ctoken)
    {
        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            TrimOptions = TrimOptions.Trim,
            HeaderValidated = null,
            MissingFieldFound = null,
            PrepareHeaderForMatch = args => args.Header.Trim().ToLower(),
        };

        using var reader = new StreamReader(pathName);

        using var csv = new CsvReader(reader, config);

        await foreach (var row in csv.GetRecordsAsync<FacilityCsvRow>(ctoken))
        {
            var facilityType = row.Typ switch
            {
                "Grillplats" => FacilityType.FirePit,
                "Vindskydd" => FacilityType.Shelter,
                _ => FacilityType.None,
            };

            if (!string.IsNullOrWhiteSpace(row.Namn)
                && row.Namn.Contains("grillplats och vindskydd", StringComparison.OrdinalIgnoreCase))
            {
                facilityType = FacilityType.FirePit | FacilityType.Shelter;
            }

            var facility = new Facility
            {
                Identifier = Guid.NewGuid().ToString(),
                Name = string.IsNullOrWhiteSpace(row.Namn) ? facilityType.GetDisplayName() : row.Namn,
                FacilityType = facilityType,
                IsAccessible = row.Tillganglighet switch
                {
                    "Tillgänglighetsanpassad" => true,
                    _ => false,
                },
                Latitude = row.Lat,
                Longitude = row.Lng,
                CreatedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow,
            };

            _stigViddDbContext.Facilities.Add(facility);
        }

        await _stigViddDbContext.SaveChangesAsync(ctoken);
    }
}

public static class FacilityTypeExtensions
{
    public static string GetDisplayName(this FacilityType type) => type switch
    {
        FacilityType.FirePit => "Grillplats",
        FacilityType.Shelter => "Vindskydd",
        FacilityType.FirePit | FacilityType.Shelter => "Grillplats och vindskydd",
        _ => "Okänd anläggning",
    };
}

public class FacilityCsvRow
{
    [Name("typ")]
    public string Typ { get; set; } = "";

    [Name("namn")]
    public string? Namn { get; set; }

    [Name("verksamhet")]
    public string? Verksamhet { get; set; }

    [Name("aktivitet")]
    public string? Aktivitet { get; set; }

    [Name("byggnadsar")]
    public double? Byggnadsar { get; set; }

    [Name("renoveringsar")]
    public double? Renoveringsar { get; set; }

    [Name("tillganglighet")]
    public string? Tillganglighet { get; set; }

    [Name("belysning")]
    public string? Belysning { get; set; }

    [Name("lat")]
    public decimal Lat { get; set; }

    [Name("lng")]
    public decimal Lng { get; set; }
}