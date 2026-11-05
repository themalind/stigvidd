// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services;
using WebDataContracts.Enums;

namespace UnitTests.ServiceTests;

public class CityAreaSuggesterTests
{
    // keep-comment: about 1.1 km of latitude per 0.01 degree, so these places sit at known distances north of the item
    private const double ItemLatitude = 57.70;
    private const double ItemLongitude = 12.90;

    private static SuggestionAreaProjection Area(string name, params (string Name, double LatitudeOffset)[] places)
    {
        return new SuggestionAreaProjection(
            $"area-{name}",
            name,
            places.Select(p => new LinkedPlaceProjection(p.Name, ItemLatitude + p.LatitudeOffset, ItemLongitude)).ToList());
    }

    [Fact]
    public void Suggest_ListsNearbyAreasClosestFirst()
    {
        // Arrange
        var areas = new[] { Area("Kype", ("Kypesjön runt", 0.03)), Area("Rya åsar", ("Ryaslingan", 0.01)) };

        // Act
        var suggestions = CityAreaSuggester.Suggest("Okänd grillplats", ItemLatitude, ItemLongitude, areas);

        // Assert
        suggestions.Select(s => s.AreaName).Should().Equal("Rya åsar", "Kype");
        var first = suggestions[0];
        first.Reason.Should().Be(AreaSuggestionReason.Nearby);
        first.NearestName.Should().Be("Ryaslingan");
        first.DistanceKm.Should().BeApproximately(1.1, 0.05);
    }

    [Fact]
    public void Suggest_LeavesOutAreasFartherThanNearbyKm()
    {
        // Arrange
        var areas = new[] { Area("Kype", ("Kypesjön runt", 0.06)), Area("Rya åsar", ("Ryaslingan", 0.01)) };

        // Act
        var suggestions = CityAreaSuggester.Suggest("Okänd grillplats", ItemLatitude, ItemLongitude, areas);

        // Assert
        suggestions.Select(s => s.AreaName).Should().Equal("Rya åsar");
    }

    [Fact]
    public void Suggest_PutsANamedAreaFirst_AndStillOffersTheNearbyOnes()
    {
        // Arrange
        var areas = new[]
        {
            Area("Kråkered", ("Kråkered Kråkstigen", 0.03)),
            Area("Gässlösa", ("Gässlösa grillplats", 0.01)),
        };

        // Act
        var suggestions = CityAreaSuggester.Suggest("Kråkered Björkehov grillplats", ItemLatitude, ItemLongitude, areas);

        // Assert
        suggestions.Select(s => (s.AreaName, s.Reason)).Should().Equal(
            ("Kråkered", AreaSuggestionReason.Name),
            ("Gässlösa", AreaSuggestionReason.Nearby));
        suggestions[0].NearestName.Should().Be("Kråkered Kråkstigen");
        suggestions[0].DistanceKm.Should().BeApproximately(3.3, 0.1);
    }

    [Fact]
    public void Suggest_GivesAtMostMaxSuggestions()
    {
        // Arrange
        var areas = Enumerable.Range(1, CityAreaSuggester.MaxSuggestions + 2)
            .Select(i => Area($"Område {i}", ($"Plats {i}", i * 0.001)))
            .ToArray();

        // Act
        var suggestions = CityAreaSuggester.Suggest("Okänd grillplats", ItemLatitude, ItemLongitude, areas);

        // Assert
        suggestions.Should().HaveCount(CityAreaSuggester.MaxSuggestions);
        suggestions.Select(s => s.AreaName).Should().Equal("Område 1", "Område 2", "Område 3");
    }

    [Fact]
    public void Suggest_NamesAnAreaOnlyOnce_WhenItIsAlsoNearby()
    {
        // Arrange
        var areas = new[] { Area("Rydboholm", ("Rydboholmsslingan", 0.01)) };

        // Act
        var suggestions = CityAreaSuggester.Suggest("Rydboholm - grillplats", ItemLatitude, ItemLongitude, areas);

        // Assert
        suggestions.Should().ContainSingle().Which.Reason.Should().Be(AreaSuggestionReason.Name);
    }

    [Theory]
    [InlineData("Kolbränningen vindskydd", "Byttorp, Kolbränningen")]
    [InlineData("Torpa badplats", "Hofsnäs och Torpa")]
    [InlineData("KRÅKERED Kråkstigen", "Kråkered")]
    public void Suggest_MatchesEachPartOfAnAreaName(string itemName, string areaName)
    {
        // Arrange
        var areas = new[] { Area(areaName), Area("Kype") };

        // Act
        var suggestions = CityAreaSuggester.Suggest(itemName, null, null, areas);

        // Assert
        var suggestion = suggestions.Should().ContainSingle().Subject;
        suggestion.AreaName.Should().Be(areaName);
        suggestion.Reason.Should().Be(AreaSuggestionReason.Name);
        suggestion.DistanceKm.Should().BeNull();
    }

    [Theory]
    [InlineData("Rydboholmsdammen grillplats")]
    [InlineData("Kypes vindskydd")]
    public void Suggest_DoesNotMatchAnAreaNameInsideAnotherWord(string itemName)
    {
        // Arrange
        var areas = new[] { Area("Rydboholm"), Area("Kype") };

        // Act
        var suggestions = CityAreaSuggester.Suggest(itemName, null, null, areas);

        // Assert
        suggestions.Should().BeEmpty();
    }

    [Fact]
    public void Suggest_IgnoresShortNameParts()
    {
        // Arrange
        var areas = new[] { Area("Borås, centrala, Öst") };

        // Act
        var suggestions = CityAreaSuggester.Suggest("Öst grillplats", null, null, areas);

        // Assert
        suggestions.Should().BeEmpty();
    }

    [Fact]
    public void Suggest_PutsTheLongestNamedAreaFirst()
    {
        // Arrange
        var areas = new[] { Area("Borås"), Area("Borås Ryda") };

        // Act
        var suggestions = CityAreaSuggester.Suggest("Borås Ryda vindskydd", null, null, areas);

        // Assert
        suggestions.Select(s => s.AreaName).Should().Equal("Borås Ryda", "Borås");
    }

    [Fact]
    public void Suggest_WithoutAPointOrAName_SuggestsNothing()
    {
        // Arrange
        var areas = new[] { Area("Kype", ("Kypesjön runt", 0.001)) };

        // Act
        var suggestions = CityAreaSuggester.Suggest("Fiskevatten", null, null, areas);

        // Assert
        suggestions.Should().BeEmpty();
    }
}
