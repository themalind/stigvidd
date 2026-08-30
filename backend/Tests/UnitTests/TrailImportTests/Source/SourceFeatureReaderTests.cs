// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.TrailImport.Source;
using AwesomeAssertions;
using System.Text;

namespace UnitTests.TrailImportTests.Source;

/// <summary>
/// The reader is the only thing standing between a hand-maintained municipal export and
/// the rest of the sync, so it has to survive what that file actually contains rather
/// than what GeoJSON allows.
/// </summary>
public class SourceFeatureReaderTests
{
    private static Stream Json(string text) => new MemoryStream(Encoding.UTF8.GetBytes(text));

    private const string OneFeature = """
    {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": { "id": 380, "namn": "Kanotcentralen - Bovik", "sparlangd": "2,5 km" },
          "geometry": { "type": "LineString", "coordinates": [
            [12.8446637, 57.6702168, 0], [12.8497814, 57.6802595, 0], [12.8603287, 57.6844817, 0]] }
        }
      ]
    }
    """;

    [Fact]
    public void Read_ForAnOrdinaryFeature_ShouldReturnItsIdNameAndGeometry()
    {
        // Act
        var features = SourceFeatureReader.Read(Json(OneFeature));

        // Assert
        features.Should().ContainSingle();
        features[0].ExternalId.Should().Be("380");
        features[0].Name.Should().Be("Kanotcentralen - Bovik");
        features[0].Geometry.NumPoints.Should().Be(3);
        // SRID 4326, not NetTopologySuite's default 0: this geometry is persisted verbatim as
        // TrailImportProposal.FeatureGeometry, and SpatiaLite rejects a mismatched SRID on insert.
        features[0].Geometry.SRID.Should().Be(GeoPointFactory.Wgs84Srid);
    }

    [Fact]
    public void Read_ShouldKeepThePropertiesVerbatim()
    {
        // Arrange — the properties go into a jsonb column and are read back by later syncs,
        // so nothing may be dropped on the way in.
        var features = SourceFeatureReader.Read(Json(OneFeature));

        // Assert
        features[0].Properties.Should().Contain("\"sparlangd\": \"2,5 km\"");
    }

    [Fact]
    public void Read_ForAnIdWrittenAsANumber_ShouldReturnItAsText()
    {
        // Arrange — the source writes id unquoted; it is only ever a label to us.
        var features = SourceFeatureReader.Read(Json(OneFeature));

        // Assert
        features[0].ExternalId.Should().Be("380");
    }

    [Fact]
    public void Read_ForAFeatureWithoutGeometry_ShouldSkipItRatherThanFail()
    {
        // Arrange — one unusable feature must not cost the other two hundred.
        var json = """
        { "features": [
          { "properties": { "id": 1, "namn": "Utan geometri" } },
          { "properties": { "id": 2, "namn": "Med geometri" },
            "geometry": { "coordinates": [[12.84, 57.67], [12.86, 57.68]] } }
        ] }
        """;

        // Act
        var features = SourceFeatureReader.Read(Json(json));

        // Assert
        features.Should().ContainSingle();
        features[0].ExternalId.Should().Be("2");
    }

    [Fact]
    public void Read_ForASinglePointGeometry_ShouldSkipIt()
    {
        // Arrange — MOCK trail id 7 in the database had exactly this, and a one-point line
        // cannot be matched against anything.
        var json = """
        { "features": [ { "properties": { "id": 1 },
          "geometry": { "coordinates": [[12.84, 57.67]] } } ] }
        """;

        // Act & Assert
        SourceFeatureReader.Read(Json(json)).Should().BeEmpty();
    }

    [Fact]
    public void Read_ForAMissingName_ShouldReturnAnEmptyString()
    {
        // Arrange — namn is absent or null on some features.
        var json = """
        { "features": [ { "properties": { "id": 5, "namn": null },
          "geometry": { "coordinates": [[12.84, 57.67], [12.86, 57.68]] } } ] }
        """;

        // Act
        var features = SourceFeatureReader.Read(Json(json));

        // Assert
        features[0].Name.Should().BeEmpty();
    }

    [Fact]
    public void Read_ForAFeatureWithoutProperties_ShouldSkipIt()
    {
        // Arrange
        var json = """
        { "features": [ { "geometry": { "coordinates": [[12.84, 57.67], [12.86, 57.68]] } } ] }
        """;

        // Act & Assert
        SourceFeatureReader.Read(Json(json)).Should().BeEmpty();
    }

    [Fact]
    public void Read_ForAFileWithNoFeaturesArray_ShouldReturnNothing()
    {
        // Act & Assert — an upload of the wrong file should be empty, not an exception.
        SourceFeatureReader.Read(Json("""{ "type": "FeatureCollection" }""")).Should().BeEmpty();
    }
}
