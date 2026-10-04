// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Factories;
using Infrastructure.Data.Entities;
using NetTopologySuite.Geometries;

namespace UnitTests.FactoryTests;

public class TrailImportResponseFactoryTests
{
    // About 1.1 km north to south, so a stated length of 1.5 km agrees and 0.2 km does not.
    private static readonly LineString Line = GeoPointFactory.FromLonLatPath(
        [new Coordinate(20.40, 63.72), new Coordinate(20.40, 63.73)]);

    private static TrailImportProposal Proposal(string properties) => new()
    {
        ExternalId = string.Empty,
        FeatureName = "Lövölandets led",
        GeometryFingerprint = "fp",
        FeatureProperties = properties,
        FeatureGeometry = Line,
    };

    [Fact]
    public void Create_ForUmeasLangdInMetres_ShouldStateItInKilometres()
    {
        // Act
        var preview = new TrailImportResponseFactory().Create(Proposal("""{ "namn": "Lövölandets led", "langd": 1546 }"""));

        // Assert
        preview.SourceStatedLengthKm.Should().Be(1.55m);
        preview.SourceLengthDisagrees.Should().BeFalse();
    }

    [Fact]
    public void Create_ForALangdFarFromTheGeometry_ShouldFlagIt()
    {
        // Act
        var preview = new TrailImportResponseFactory().Create(Proposal("""{ "langd": 213 }"""));

        // Assert
        preview.SourceLengthDisagrees.Should().BeTrue();
    }

    [Fact]
    public void Create_ForALangdOfZero_ShouldStateNothing()
    {
        // Arrange — Umeå writes 0 for a stretch it never measured, which is not a length.
        var preview = new TrailImportResponseFactory().Create(Proposal("""{ "langd": 0 }"""));

        // Assert
        preview.SourceStatedLengthKm.Should().BeNull();
        preview.SourceLengthDisagrees.Should().BeFalse();
    }

    [Fact]
    public void Create_ForBothFields_ShouldPreferSparlangd()
    {
        // Act
        var preview = new TrailImportResponseFactory().Create(Proposal("""{ "sparlangd": "2,5 km", "langd": 1546 }"""));

        // Assert
        preview.SourceStatedLengthKm.Should().Be(2.5m);
    }
}
