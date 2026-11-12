// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Infrastructure.Enums;

namespace UnitTests.ServiceTests;

public class FacilityFileReaderTests
{
    private const string Source = "boras-badplatser";

    private const string BathingSites = """
        {
          "type": "FeatureCollection",
          "crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },
          "features": [
            {
              "type": "Feature",
              "geometry": { "type": "Point", "coordinates": [ 12.9396439434, 57.7617761258 ] },
              "properties": {
                "place_id": "1490-6472",
                "name": "Almenäs badplats",
                "description": "  Sandstrand vid Öresjö.  ",
                "visit_url": "https://www.boras.se/5.74fc8b6d18d54c7383223e4.html"
              }
            },
            {
              "type": "Feature",
              "geometry": { "type": "Point", "coordinates": [ 12.66, 57.56 ] },
              "properties": { "place_id": "1490-6724", "name": "Buastrand badplats", "description": null, "visit_url": null }
            },
            {
              "type": "Feature",
              "geometry": { "type": "LineString", "coordinates": [ [ 12.0, 57.0 ], [ 12.1, 57.1 ] ] },
              "properties": { "place_id": "1490-1", "name": "Ingen punkt" }
            },
            {
              "type": "Feature",
              "geometry": { "type": "Point", "coordinates": [ 12.0, 57.0 ] },
              "properties": { "place_id": "1490-2" }
            }
          ]
        }
        """;

    private const string Outdoor = """
        {
          "type": "FeatureCollection",
          "features": [
            { "type": "Feature", "geometry": { "type": "Point", "coordinates": [ 12.95, 57.75 ] },
              "properties": { "fid": 1, "typ": "Grillplats", "namn": "Rya åsar - grillplats" } },
            { "type": "Feature", "geometry": { "type": "Point", "coordinates": [ 12.95, 57.75 ] },
              "properties": { "fid": 2, "typ": "Vindskydd", "namn": "Rya åsar - vindskydd" } },
            { "type": "Feature", "geometry": { "type": "Point", "coordinates": [ 12.96, 57.76 ] },
              "properties": { "fid": 3, "typ": "Toalett", "namn": "Rya åsar - toalett" } }
          ]
        }
        """;

    private static readonly FacilityImportMapping BathingMapping = new(
        IdField: "place_id",
        NameField: "name",
        DescriptionField: "description",
        UrlField: "visit_url",
        TypeField: null,
        FixedType: FacilityType.SwimmingArea,
        TypeValues: new Dictionary<string, FacilityType>());

    private static readonly FacilityImportMapping OutdoorMapping = new(
        IdField: null,
        NameField: "namn",
        DescriptionField: null,
        UrlField: null,
        TypeField: "typ",
        FixedType: FacilityType.None,
        TypeValues: new Dictionary<string, FacilityType>
        {
            ["Grillplats"] = FacilityType.FirePit,
            ["Vindskydd"] = FacilityType.Shelter,
            ["Toalett"] = FacilityType.None,
        });

    private static IReadOnlyCollection<SourceFacility> Sites(string geoJson, FacilityImportMapping mapping)
    {
        return File(geoJson, mapping).Sites;
    }

    private static FacilityFile File(string geoJson, FacilityImportMapping mapping)
    {
        var result = FacilityFileReader.Read(geoJson, Source, mapping);
        result.Success.Should().BeTrue();
        return result.Value ?? throw new InvalidOperationException("expected sites");
    }

    private static string Points(params string[] properties)
    {
        var features = properties.Select((p, i) =>
            $$"""{ "type": "Feature", "geometry": { "type": "Point", "coordinates": [ 12.9{{i}}, 57.7 ] }, "properties": {{p}} }""");

        return $$"""{ "type": "FeatureCollection", "features": [ {{string.Join(",", features)}} ] }""";
    }

    private static string Failure(string geoJson, FacilityImportMapping mapping)
    {
        var result = FacilityFileReader.Read(geoJson, Source, mapping);
        result.Success.Should().BeFalse();
        var message = result.Message;
        message.Should().NotBeNull();
        if (message is null) throw new InvalidOperationException("expected a message");
        message.StatusCode.Should().Be(400);
        return message.ResultMessage ?? "";
    }

    private static string OnePoint(string placeId, double longitude, double latitude, string crs = "")
    {
        return $$"""
            { "type": "FeatureCollection", {{crs}}
              "features": [ { "type": "Feature",
                "geometry": { "type": "Point", "coordinates": [ {{longitude}}, {{latitude}} ] },
                "properties": { "place_id": {{placeId}}, "name": "Badet" } } ] }
            """;
    }

    [Fact]
    public void Read_ReadsEveryPointFeatureWithAName()
    {
        // Act
        var sites = Sites(BathingSites, BathingMapping);

        // Assert
        sites.Select(s => s.Name).Should().Equal("Almenäs badplats", "Buastrand badplats");
    }

    [Fact]
    public void Read_MapsTheChosenFields()
    {
        // Act
        var site = Sites(BathingSites, BathingMapping).First();

        // Assert
        site.SourceId.Should().Be("boras-badplatser:1490-6472");
        site.Description.Should().Be("Sandstrand vid Öresjö.");
        site.Url.Should().Be("https://www.boras.se/5.74fc8b6d18d54c7383223e4.html");
        site.Longitude.Should().Be(12.9396439434);
        site.Latitude.Should().Be(57.7617761258);
        site.Type.Should().Be(FacilityType.SwimmingArea);
    }

    [Fact]
    public void Read_TurnsMissingTextIntoNull()
    {
        // Act
        var site = Sites(BathingSites, BathingMapping).Last();

        // Assert
        site.Description.Should().BeNull();
        site.Url.Should().BeNull();
    }

    [Fact]
    public void Read_TakesANumericId()
    {
        // Act
        var site = Sites(OnePoint("102", 12.9, 57.7), BathingMapping).Single();

        // Assert
        site.SourceId.Should().Be("boras-badplatser:102");
    }

    [Fact]
    public void Read_GivesEachFeatureTheTypeItsValueMapsTo()
    {
        // Act
        var sites = Sites(Outdoor, OutdoorMapping);

        // Assert
        sites.Select(s => (s.Name, s.Type)).Should().Equal(
            ("Rya åsar - grillplats", FacilityType.FirePit),
            ("Rya åsar - vindskydd", FacilityType.Shelter));
    }

    [Fact]
    public void Read_GivesAFileWithoutIdsPositionIdsThatStayApart()
    {
        // Act
        var sites = Sites(Outdoor, OutdoorMapping);

        // Assert
        sites.Select(s => s.SourceId).Should().Equal(
            "boras-badplatser:@57.75000,12.95000",
            "boras-badplatser:@57.75000,12.95000#2");
    }

    [Fact]
    public void Read_RefusesATypeValueWithoutAFacilityType()
    {
        // Arrange
        var partial = OutdoorMapping with
        {
            TypeValues = new Dictionary<string, FacilityType> { ["Grillplats"] = FacilityType.FirePit },
        };

        // Act
        var message = Failure(Outdoor, partial);

        // Assert
        message.Should().Contain("\"Vindskydd\" in typ");
    }

    [Fact]
    public void Read_RefusesAFeatureWithoutTheChosenId()
    {
        // Arrange
        var byFid = OutdoorMapping with { IdField = "id" };

        // Act
        var message = Failure(Outdoor, byFid);

        // Assert
        message.Should().Contain("has no id");
    }

    [Fact]
    public void Read_RefusesAFileInAProjectedCoordinateSystem()
    {
        // Arrange
        var sweref = OnePoint("\"1\"", 150000, 6400000, """ "crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:EPSG::3006" } }, """);

        // Act
        var message = Failure(sweref, BathingMapping);

        // Assert
        message.Should().Contain("EPSG::3006");
    }

    [Fact]
    public void Read_RefusesCoordinatesOutsideWgs84EvenWithoutACrs()
    {
        // Act
        var message = Failure(OnePoint("\"1\"", 150000, 6400000), BathingMapping);

        // Assert
        message.Should().Contain("outside WGS84");
    }

    [Fact]
    public void Read_RefusesAnIdTooLongForTheSourceId()
    {
        // Act
        var message = Failure(OnePoint($"\"{new string('x', FacilityFileReader.MaxIdLength + 1)}\"", 12.9, 57.7), BathingMapping);

        // Assert
        message.Should().Contain("place_id");
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("[]")]
    [InlineData("""{ "type": "FeatureCollection", "features": [] }""")]
    public void Read_RefusesAFileWithoutFacilities(string geoJson)
    {
        // Act
        var message = Failure(geoJson, BathingMapping);

        // Assert
        message.Should().NotBeEmpty();
    }

    [Fact]
    public void Read_RefusesAnIdFieldWhoseValuesRepeat()
    {
        // Arrange
        var file = Points("""{ "place_id": "7", "name": "Grillen" }""", """{ "place_id": "7", "name": "Skyddet" }""");

        // Act
        var message = Failure(file, BathingMapping);

        // Assert
        message.Should().Contain("place_id is not unique: 7");
    }

    [Fact]
    public void Read_LooksUpAPointWithoutATypeValueAsEmpty()
    {
        // Arrange
        var file = Points("""{ "namn": "Grillen", "typ": "Grillplats" }""", """{ "namn": "Okänd" }""");
        var mapping = OutdoorMapping with
        {
            TypeValues = new Dictionary<string, FacilityType> { ["Grillplats"] = FacilityType.FirePit, [""] = FacilityType.None },
        };

        // Act
        var sites = Sites(file, mapping);

        // Assert
        sites.Select(s => s.Name).Should().Equal("Grillen");
    }

    [Fact]
    public void Read_LooksUpANumericTypeValueInItsShortestForm()
    {
        // Arrange
        var file = Points("""{ "namn": "Grillen", "typ": 1.0 }""", """{ "namn": "Skyddet", "typ": 2.50 }""");
        var mapping = OutdoorMapping with
        {
            TypeValues = new Dictionary<string, FacilityType> { ["1"] = FacilityType.FirePit, ["2.5"] = FacilityType.Shelter },
        };

        // Act
        var sites = Sites(file, mapping);

        // Assert
        sites.Select(s => s.Type).Should().Equal(FacilityType.FirePit, FacilityType.Shelter);
    }

    [Fact]
    public void Read_KeepsTextWithinWhatAnEditCanSaveAndSaysWhatItChanged()
    {
        // Arrange
        var longName = new string('n', 120);
        var longDescription = new string('d', 2100);
        var file = Points(
            $$"""{ "place_id": "1", "name": "{{longName}}", "description": "{{longDescription}}", "visit_url": "www.boras.se/bad" }""",
            """{ "place_id": "2", "name": "Skript", "visit_url": "javascript:alert(1)" }""",
            """{ "place_id": "3", "name": "Bra", "visit_url": "https://www.boras.se/bad" }""");

        // Act
        var read = File(file, BathingMapping);

        // Assert
        var sites = read.Sites.ToList();
        sites[0].Name.Should().HaveLength(100);
        sites[0].Description.Should().HaveLength(2000);
        sites[0].Url.Should().BeNull();
        sites[1].Url.Should().BeNull();
        sites[2].Url.Should().Be("https://www.boras.se/bad");
        read.Notes.Should().HaveCount(4);
        read.Notes.Should().Contain(n => n.Contains("\"www.boras.se/bad\" is not a full web address"));
    }

    [Fact]
    public void Read_SaysWhichNameFieldFoundNothing()
    {
        // Act
        var message = Failure(Outdoor, BathingMapping);

        // Assert
        message.Should().Contain("name");
    }
}
