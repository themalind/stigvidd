// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Globalization;
using AwesomeAssertions;
using Core.Spatial;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using WebDataContracts.Enums;

namespace UnitTests.ServiceTests;

public class FacilityImportPlannerTests
{
    private const string Source = "boras-badplatser";

    private static SourceFacility Site(
        string id = "1490-6472",
        string name = "Almenäs badplats",
        string? description = "Sandstrand vid Öresjö.",
        string? url = "https://www.boras.se/almenas",
        double longitude = 12.9396439434,
        double latitude = 57.7617761258,
        FacilityType type = FacilityType.SwimmingArea)
    {
        return new SourceFacility($"{Source}:{id}", name, description, url, longitude, latitude, type);
    }

    private static Facility Imported(SourceFacility site)
    {
        return new Facility
        {
            Name = site.Name,
            Description = site.Description,
            Url = site.Url,
            Coordinates = GeoPointFactory.FromLonLat(site.Longitude, site.Latitude),
            FacilityType = site.Type,
            SourceId = site.SourceId,
            SourceSnapshot = FacilitySourceSnapshot.From(site).ToJson(),
        };
    }

    private static FacilityImportPlan Plan(
        IReadOnlyCollection<SourceFacility> sites,
        IReadOnlyCollection<Facility> facilities,
        IReadOnlyCollection<FacilityImportLink>? links = null,
        IReadOnlyCollection<FacilityImportKeep>? kept = null,
        bool matchOnPosition = false)
    {
        var result = FacilityImportPlanner.Plan(Source, sites, facilities, links ?? [], kept ?? [], matchOnPosition);
        result.Success.Should().BeTrue();
        var plan = result.Value;
        plan.Should().NotBeNull();
        return plan ?? throw new InvalidOperationException("expected a plan");
    }

    [Fact]
    public void Plan_CreatesASourceFacilityWeDoNotHave()
    {
        // Arrange
        var site = Site();

        // Act
        var plan = Plan([site], []);

        // Assert
        var created = plan.Creates.Should().ContainSingle().Subject;
        created.SourceId.Should().Be($"{Source}:1490-6472");
        created.Name.Should().Be("Almenäs badplats");
        created.FacilityType.Should().Be(FacilityType.SwimmingArea);
        var point = created.Coordinates;
        point.Should().NotBeNull();
        if (point is null) throw new InvalidOperationException("expected coordinates");
        point.X.Should().Be(12.9396439434);
        point.Y.Should().Be(57.7617761258);
        point.SRID.Should().Be(GeoPointFactory.Wgs84Srid);
        plan.Rows.Should().ContainSingle().Which.Kind.Should().Be(FacilityImportRowKind.New);
        plan.Counts.Created.Should().Be(1);
    }

    [Fact]
    public void Plan_KeepsALocalEditWhenTheSourceDidNotChange()
    {
        // Arrange
        var site = Site();
        var facility = Imported(site);
        facility.Name = "Almenäs (vår text)";

        // Act
        var plan = Plan([site], [facility]);

        // Assert
        facility.Name.Should().Be("Almenäs (vår text)");
        var row = plan.Rows.Should().ContainSingle().Subject;
        row.Kind.Should().Be(FacilityImportRowKind.Unchanged);
        row.Changes.Should().BeEmpty();
        plan.Updates.Should().BeEmpty();
        plan.Counts.Unchanged.Should().Be(1);
    }

    [Fact]
    public void Plan_TakesAFieldTheSourceChanged()
    {
        // Arrange
        var facility = Imported(Site());
        var changed = Site(description: "Ny beskrivning från kommunen.");

        // Act
        var plan = Plan([changed], [facility]);

        // Assert
        facility.Description.Should().Be("Ny beskrivning från kommunen.");
        var change = plan.Rows.Should().ContainSingle().Which.Changes.Should().ContainSingle().Subject;
        change.Field.Should().Be(FacilityImportField.Description);
        change.Current.Should().Be("Sandstrand vid Öresjö.");
        change.OverwritesLocalEdit.Should().BeFalse();
        plan.Updates.Should().ContainSingle().Which.Should().BeSameAs(facility);
        plan.Counts.Updated.Should().Be(1);
    }

    [Fact]
    public void Plan_TheSourceWinsOverALocalEditOfAFieldItChanged()
    {
        // Arrange
        var facility = Imported(Site());
        facility.Description = "Vår text";
        var changed = Site(description: "Ny beskrivning från kommunen.");

        // Act
        var plan = Plan([changed], [facility]);

        // Assert
        facility.Description.Should().Be("Ny beskrivning från kommunen.");
        var change = plan.Rows.Should().ContainSingle().Which.Changes.Should().ContainSingle().Subject;
        change.Field.Should().Be(FacilityImportField.Description);
        change.Current.Should().Be("Vår text");
        change.OverwritesLocalEdit.Should().BeTrue();
    }

    [Fact]
    public void Plan_NeverRenamesAnImportedFacility()
    {
        // Arrange
        var facility = Imported(Site());
        facility.Name = "Almenäs (vårt namn)";
        var renamed = Site(name: "Almenäs strandbad");

        // Act
        var plan = Plan([renamed], [facility]);

        // Assert
        facility.Name.Should().Be("Almenäs (vårt namn)");
        plan.Rows.Should().ContainSingle().Which.Changes.Should().BeEmpty();
    }

    [Fact]
    public void Plan_MovesTheFacilityWhenTheSourceMovedIt()
    {
        // Arrange
        var facility = Imported(Site());
        var moved = Site(latitude: 57.7700);

        // Act
        var plan = Plan([moved], [facility]);

        // Assert
        plan.Rows.Should().ContainSingle().Which.Changes.Should().ContainSingle()
            .Which.Field.Should().Be(FacilityImportField.Coordinates);
        var point = facility.Coordinates;
        if (point is null) throw new InvalidOperationException("expected coordinates");
        point.Y.Should().Be(57.7700);
    }

    [Fact]
    public void Plan_ReplacesTheTypeTheSourceChangedAndKeepsOneAddedHere()
    {
        // Arrange
        var facility = Imported(Site(type: FacilityType.FirePit));
        facility.FacilityType |= FacilityType.NatureReserve;
        var reclassified = Site(type: FacilityType.Shelter);

        // Act
        var plan = Plan([reclassified], [facility]);

        // Assert
        facility.FacilityType.Should().Be(FacilityType.Shelter | FacilityType.NatureReserve);
        var change = plan.Rows.Should().ContainSingle().Which.Changes.Should().ContainSingle().Subject;
        change.Field.Should().Be(FacilityImportField.Type);
        change.Current.Should().Be(((int)(FacilityType.FirePit | FacilityType.NatureReserve)).ToString(CultureInfo.InvariantCulture));
        change.Incoming.Should().Be(((int)(FacilityType.Shelter | FacilityType.NatureReserve)).ToString(CultureInfo.InvariantCulture));
        change.OverwritesLocalEdit.Should().BeTrue();
        plan.Updates.Should().ContainSingle();
    }

    [Fact]
    public void Plan_LeavesATypeChangedHereWhenTheSourceKeptItsType()
    {
        // Arrange
        var facility = Imported(Site(type: FacilityType.FirePit));
        facility.FacilityType = FacilityType.Shelter;

        // Act
        var plan = Plan([Site(type: FacilityType.FirePit)], [facility]);

        // Assert
        facility.FacilityType.Should().Be(FacilityType.Shelter);
        plan.Rows.Should().ContainSingle().Which.Changes.Should().BeEmpty();
    }

    [Fact]
    public void Plan_KeepsOurTypeWhenAsked()
    {
        // Arrange
        var facility = Imported(Site(type: FacilityType.FirePit));
        var reclassified = Site(type: FacilityType.Shelter);

        // Act
        var plan = Plan([reclassified], [facility], kept: [new FacilityImportKeep(reclassified.SourceId, FacilityImportField.Type)]);

        // Assert
        facility.FacilityType.Should().Be(FacilityType.FirePit);
        plan.Rows.Should().ContainSingle().Which.Changes.Should().ContainSingle().Which.Kept.Should().BeTrue();
        plan.Counts.Updated.Should().Be(0);
        plan.Counts.Unchanged.Should().Be(1);
    }

    [Fact]
    public void Plan_LinksTheSuggestedTwinWhenNoChoiceIsGiven()
    {
        // Arrange
        var mock = new Facility { Name = "Almenäs", FacilityType = FacilityType.SwimmingArea };

        // Act
        var plan = Plan([Site()], [mock]);

        // Assert
        var row = plan.Rows.Should().ContainSingle().Subject;
        row.Kind.Should().Be(FacilityImportRowKind.New);
        row.Facility.Should().Be(new FacilityReference(mock.Identifier, "Almenäs", FacilityType.SwimmingArea));
        row.SuggestedFacility.Should().Be(row.Facility);
        plan.Creates.Should().BeEmpty();
        plan.Updates.Should().ContainSingle().Which.Should().BeSameAs(mock);
    }

    [Fact]
    public void Plan_CreatesANewFacilityWhenTheChoiceSaysSo()
    {
        // Arrange
        var mock = new Facility { Name = "Almenäs", FacilityType = FacilityType.SwimmingArea };
        var site = Site();

        // Act
        var plan = Plan([site], [mock], [new FacilityImportLink(site.SourceId, null)]);

        // Assert
        var row = plan.Rows.Should().ContainSingle().Subject;
        row.Facility.Should().BeNull();
        row.SuggestedFacility.Should().Be(new FacilityReference(mock.Identifier, mock.Name, FacilityType.SwimmingArea));
        row.Changes.Should().OnlyContain(c => c.Current == null);
        plan.Creates.Should().ContainSingle();
        plan.Updates.Should().BeEmpty();
        mock.SourceId.Should().BeNull();
    }

    [Fact]
    public void Plan_ShowsTheChangesAgainstTheChosenFacilityNotTheSuggestion()
    {
        // Arrange
        var suggested = new Facility { Name = "Almenäs", FacilityType = FacilityType.SwimmingArea };
        var chosen = new Facility { Name = "Öresjö strand", Description = "Vår text", FacilityType = FacilityType.SwimmingArea };
        var site = Site();

        // Act
        var plan = Plan([site], [suggested, chosen], [new FacilityImportLink(site.SourceId, chosen.Identifier)]);

        // Assert
        var row = plan.Rows.Should().ContainSingle().Subject;
        row.Facility.Should().NotBeNull();
        row.Facility?.Identifier.Should().Be(chosen.Identifier);
        row.Changes.Should().Contain(c => c.Field == FacilityImportField.Description && c.Current == "Vår text");
        row.Changes.Should().NotContain(c => c.Field == FacilityImportField.Name);
        chosen.Name.Should().Be("Öresjö strand");
        plan.Updates.Should().ContainSingle().Which.Should().BeSameAs(chosen);
        suggested.SourceId.Should().BeNull();
    }

    [Fact]
    public void Plan_WarnsWhenLinkingReplacesTextWeWrote()
    {
        // Arrange
        var mock = new Facility { Name = "Almenäs", Description = "Vår text", FacilityType = FacilityType.SwimmingArea };

        // Act
        var plan = Plan([Site()], [mock]);

        // Assert
        var changes = plan.Rows.Should().ContainSingle().Subject.Changes;
        changes.Single(c => c.Field == FacilityImportField.Description).OverwritesLocalEdit.Should().BeTrue();
        changes.Single(c => c.Field == FacilityImportField.Coordinates).OverwritesLocalEdit.Should().BeFalse();
    }

    [Fact]
    public void Plan_DoesNotSuggestATwinMoreThanFiveKilometresAway()
    {
        // Arrange
        var elsewhere = new Facility
        {
            Name = "Almenäs",
            FacilityType = FacilityType.SwimmingArea,
            Coordinates = GeoPointFactory.FromLonLat(13.4180, 57.7930),
        };

        // Act
        var plan = Plan([Site()], [elsewhere]);

        // Assert
        plan.Rows.Should().ContainSingle().Which.SuggestedFacility.Should().BeNull();
        plan.Creates.Should().ContainSingle();
        elsewhere.SourceId.Should().BeNull();
    }

    [Fact]
    public void Plan_SuggestsATwinWithinFiveKilometres()
    {
        // Arrange
        var nearby = new Facility
        {
            Name = "Almenäs",
            FacilityType = FacilityType.SwimmingArea,
            Coordinates = GeoPointFactory.FromLonLat(12.9500, 57.7650),
        };

        // Act
        var plan = Plan([Site()], [nearby]);

        // Assert
        plan.Rows.Should().ContainSingle().Which.SuggestedFacility?.Identifier.Should().Be(nearby.Identifier);
    }

    [Fact]
    public void Plan_LinkingKeepsTextTheSourceDoesNotHave()
    {
        // Arrange
        var mock = new Facility { Name = "Almenäs", Description = "Vår text", Url = "https://example.se/almenas", FacilityType = FacilityType.SwimmingArea };
        var bare = Site(description: null, url: null);

        // Act
        var plan = Plan([bare], [mock]);

        // Assert
        mock.Description.Should().Be("Vår text");
        mock.Url.Should().Be("https://example.se/almenas");
        plan.Rows.Should().ContainSingle().Which.Changes
            .Should().NotContain(c => c.Field == FacilityImportField.Description || c.Field == FacilityImportField.Url);
    }

    [Fact]
    public void Plan_LinksButKeepsOurTextWhenAskedTo()
    {
        // Arrange
        var mock = new Facility { Name = "Almenäs", Description = "Vår text", FacilityType = FacilityType.SwimmingArea };
        var site = Site();

        // Act
        var plan = Plan([site], [mock], kept: [new FacilityImportKeep(site.SourceId, FacilityImportField.Description)]);

        // Assert
        mock.SourceId.Should().Be(site.SourceId);
        mock.Description.Should().Be("Vår text");
        mock.Coordinates.Should().NotBeNull();
        mock.SourceSnapshot.Should().Be(FacilitySourceSnapshot.From(site).ToJson());
        var changes = plan.Rows.Should().ContainSingle().Subject.Changes;
        changes.Single(c => c.Field == FacilityImportField.Description).Kept.Should().BeTrue();
        changes.Single(c => c.Field == FacilityImportField.Coordinates).Kept.Should().BeFalse();
    }

    [Fact]
    public void Plan_AKeptFieldIsLeftAloneUntilTheSourceChangesItAgain()
    {
        // Arrange
        var site = Site();
        var facility = Imported(site);
        facility.Description = "Vår text";
        var changed = Site(description: "Ny beskrivning från kommunen.");

        // Act
        var kept = Plan([changed], [facility], kept: [new FacilityImportKeep(site.SourceId, FacilityImportField.Description)]);
        var again = Plan([changed], [facility]);

        // Assert
        kept.Rows.Should().ContainSingle().Which.Kind.Should().Be(FacilityImportRowKind.Changed);
        facility.Description.Should().Be("Vår text");
        again.Rows.Should().ContainSingle().Which.Kind.Should().Be(FacilityImportRowKind.Unchanged);
    }

    [Fact]
    public void Plan_CreatesEachSiteWithTheTypeTheFileGivesIt()
    {
        // Arrange
        var firePit = Site(id: "1", name: "Rya åsar - grillplats", type: FacilityType.FirePit);
        var shelter = Site(id: "2", name: "Rya åsar - vindskydd", latitude: 57.70, type: FacilityType.Shelter);

        // Act
        var plan = Plan([firePit, shelter], []);

        // Assert
        plan.Creates.Select(f => f.FacilityType).Should().BeEquivalentTo([FacilityType.FirePit, FacilityType.Shelter]);
        plan.Rows.Select(r => r.Type).Should().BeEquivalentTo([FacilityType.FirePit, FacilityType.Shelter]);
    }

    [Fact]
    public void Plan_SuggestsOnlyATwinOfTheSameType()
    {
        // Arrange
        var ourFirePit = new Facility { Name = "Rya åsar", FacilityType = FacilityType.FirePit };
        var shelter = Site(id: "2", name: "Rya åsar vindskydd", type: FacilityType.Shelter);
        var otherFirePit = Site(id: "3", name: "Kypesjön grillplats", latitude: 57.70, type: FacilityType.FirePit);

        // Act
        var plan = Plan([shelter, otherFirePit], [ourFirePit]);

        // Assert
        plan.Rows.Single(r => r.Name == "Rya åsar vindskydd").SuggestedFacility.Should().BeNull();
        plan.UnlinkedFacilities.Should().ContainSingle();
        ourFirePit.SourceId.Should().BeNull();
    }

    [Fact]
    public void Plan_MatchesAFileWithoutIdsOnPosition()
    {
        // Arrange
        var before = PositionSite(12.9396, 57.7617);
        var facility = Imported(before);
        var moved = PositionSite(12.9396, 57.76173);

        // Act
        var plan = Plan([moved], [facility], matchOnPosition: true);

        // Assert
        var row = plan.Rows.Should().ContainSingle().Subject;
        row.Kind.Should().Be(FacilityImportRowKind.Changed);
        row.SourceId.Should().Be(before.SourceId);
        plan.Creates.Should().BeEmpty();
        plan.Counts.Missing.Should().Be(0);
    }

    [Fact]
    public void Plan_TwoNearbySitesWithoutIdsEachKeepTheirOwnFacility()
    {
        // Arrange
        var west = Imported(PositionSite(12.93950, 57.7617));
        var east = Imported(PositionSite(12.93966, 57.7617));
        var nearWest = PositionSite(12.93951, 57.7617);
        var nearEast = PositionSite(12.93965, 57.7617);

        // Act
        var plan = Plan([nearEast, nearWest], [west, east], matchOnPosition: true);

        // Assert
        plan.Rows.Should().HaveCount(2).And.OnlyContain(r => r.Kind != FacilityImportRowKind.New && r.Kind != FacilityImportRowKind.Missing);
        plan.Rows.Select(r => r.Facility?.Identifier).Should().BeEquivalentTo([west.Identifier, east.Identifier]);
        plan.Rows.Single(r => r.Facility?.Identifier == west.Identifier).SourceId.Should().Be(west.SourceId);
    }

    [Fact]
    public void Plan_DoesNotMatchOnPositionAcrossTypes()
    {
        // Arrange
        var firePit = Imported(PositionSite(12.9396, 57.7617, FacilityType.FirePit));
        var shelterBeside = PositionSite(12.93961, 57.7617, FacilityType.Shelter);

        // Act
        var plan = Plan([shelterBeside], [firePit], matchOnPosition: true);

        // Assert
        plan.Rows.Should().Contain(r => r.Kind == FacilityImportRowKind.New);
        plan.Rows.Should().Contain(r => r.Kind == FacilityImportRowKind.Missing);
    }

    private static SourceFacility PositionSite(double longitude, double latitude, FacilityType type = FacilityType.FirePit)
    {
        return Site(
            id: FacilityFileReader.PositionId(longitude, latitude),
            name: "Grillplats",
            longitude: longitude,
            latitude: latitude,
            type: type);
    }

    [Fact]
    public void Plan_HasWorkWhenOnlyTheBaselineIsStale()
    {
        // Arrange
        var facility = Imported(Site());
        facility.Description = "Ny beskrivning från kommunen.";
        var site = Site(description: "Ny beskrivning från kommunen.");

        // Act
        var plan = Plan([site], [facility]);

        // Assert
        plan.Rows.Should().ContainSingle().Which.Kind.Should().Be(FacilityImportRowKind.Unchanged);
        plan.HasWork.Should().BeTrue();
        facility.SourceSnapshot.Should().Be(FacilitySourceSnapshot.From(site).ToJson());
    }

    [Fact]
    public void Plan_DoesNotSuggestByAUrlTwoSourceFacilitiesShare()
    {
        // Arrange
        var shared = "https://www.boras.se/samma";
        var valsjon = Site(id: "1490-6750", name: "Östra Valsjön badplats", url: shared);
        var rammsjon = Site(id: "1490-6729", name: "Rammsjön badplats", url: shared);
        var mock = new Facility { Name = "Rammsjön", Url = shared, FacilityType = FacilityType.SwimmingArea };

        // Act
        var plan = Plan([valsjon, rammsjon], [mock]);

        // Assert
        plan.Rows.Single(r => r.Name == "Östra Valsjön badplats").SuggestedFacility.Should().BeNull();
        plan.Rows.Single(r => r.Name == "Rammsjön badplats").SuggestedFacility
            .Should().Be(new FacilityReference(mock.Identifier, "Rammsjön", FacilityType.SwimmingArea));
    }

    [Fact]
    public void Plan_ALinkAttachesTheSourceToAnExistingFacility()
    {
        // Arrange
        var mock = new Facility { Name = "Almenäs", Description = "Mocktext", FacilityType = FacilityType.FirePit | FacilityType.SwimmingArea };
        var site = Site();

        // Act
        var plan = Plan([site], [mock], [new FacilityImportLink(site.SourceId, mock.Identifier)]);

        // Assert
        plan.Creates.Should().BeEmpty();
        plan.Updates.Should().ContainSingle().Which.Should().BeSameAs(mock);
        mock.SourceId.Should().Be(site.SourceId);
        mock.Name.Should().Be("Almenäs");
        mock.Description.Should().Be("Sandstrand vid Öresjö.");
        mock.Coordinates.Should().NotBeNull();
        mock.FacilityType.Should().Be(FacilityType.FirePit | FacilityType.SwimmingArea);
        mock.SourceSnapshot.Should().NotBeNull();
        plan.Counts.Linked.Should().Be(1);
    }

    [Fact]
    public void Plan_ReportsAFacilityTheSourceNoLongerHasWithoutTouchingIt()
    {
        // Arrange
        var gone = Imported(Site(id: "1490-9999", name: "Nedlagd badplats"));

        // Act
        var plan = Plan([Site()], [gone]);

        // Assert
        var row = plan.Rows.Single(r => r.Kind == FacilityImportRowKind.Missing);
        row.Facility.Should().Be(new FacilityReference(gone.Identifier, gone.Name, FacilityType.SwimmingArea));
        plan.Updates.Should().BeEmpty();
        plan.Counts.Missing.Should().Be(1);
    }

    [Fact]
    public void Plan_IgnoresFacilitiesFromAnotherSource()
    {
        // Arrange
        var other = new Facility { Name = "Annat bad", FacilityType = FacilityType.SwimmingArea, SourceId = "ulricehamn-bad:1" };

        // Act
        var plan = Plan([Site()], [other]);

        // Assert
        plan.Rows.Should().ContainSingle().Which.Kind.Should().Be(FacilityImportRowKind.New);
        plan.UnlinkedFacilities.Should().BeEmpty();
    }

    [Fact]
    public void Plan_RefusesALinkToAFacilityThatCannotBeLinked()
    {
        // Arrange
        var site = Site();
        var link = new FacilityImportLink(site.SourceId, "no-such-facility");

        // Act
        var result = FacilityImportPlanner.Plan(Source, [site], [], [link], [], matchOnPosition: false);

        // Assert
        result.Success.Should().BeFalse();
        var message = result.Message;
        message.Should().NotBeNull();
        if (message is null) throw new InvalidOperationException("expected a message");
        message.StatusCode.Should().Be(400);
    }
}
