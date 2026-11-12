// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Infrastructure.Enums;
using WebDataContracts.Enums;
using WebDataContracts.RequestModels.Facility;
using WebDataContracts.RequestModels.Municipality;
using WebDataContracts.ResponseModels.Facility;
using WebDataContracts.ResponseModels.Municipality;

namespace IntegrationTests.Admin;

public class AdminFacilityImportControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string ApplyRoute = "/api/v1/admin/facilities/import";
    private const string PreviewRoute = "/api/v1/admin/facilities/import/preview";
    private const string FacilitiesRoute = "/api/v1/admin/facilities";
    private const string MunicipalitiesRoute = "/api/v1/admin/municipalities";
    private const string SourcesRoute = "/api/v1/admin/facilities/import/sources";
    private const string AuthenticatedUser = "firebase-uid-12346"; // VandrarVennen

    private sealed record Site(string PlaceId, string Name, string? Description, double Longitude, double Latitude);

    private static readonly Site Almenas = new("1490-6472", "Almenäs badplats", "Sandstrand vid Öresjö.", 12.9396439434, 57.7617761258);
    private static readonly Site Asklanda = new("1490-6473", "Asklanda badplats", null, 12.998521979, 57.8131198527);

    public AdminFacilityImportControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private HttpClient AdminClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, TestAuthHandler.AdminRole);
        return client;
    }

    private static async Task<string> MunicipalityAsync(HttpClient client, string name)
    {
        var ct = TestContext.Current.CancellationToken;
        var existing = await Read<List<MunicipalityResponse>>(await client.GetAsync(MunicipalitiesRoute, ct));

        if (existing.Find(m => m.Name == name) is { } found)
            return found.Identifier;

        var created = await client.PostAsJsonAsync(MunicipalitiesRoute, new CreateMunicipalityRequest { Name = name }, ct);
        return (await Read<MunicipalityResponse>(created)).Identifier;
    }

    private static async Task<string> SourceAsync(HttpClient client, string municipality, string name = "Badplatser")
    {
        var ct = TestContext.Current.CancellationToken;
        var existing = await Read<List<FacilityImportSourceResponse>>(await client.GetAsync(SourcesRoute, ct));

        if (existing.Find(s => s.MunicipalityName == municipality && s.Name == name) is { } found)
            return found.Identifier;

        var request = new CreateFacilityImportSourceRequest { MunicipalityIdentifier = await MunicipalityAsync(client, municipality), Name = name };
        return (await Read<FacilityImportSourceResponse>(await client.PostAsJsonAsync(SourcesRoute, request, ct))).Identifier;
    }

    private static FacilityImportMappingRequest BathingMapping()
    {
        return new FacilityImportMappingRequest
        {
            IdField = "place_id",
            NameField = "name",
            DescriptionField = "description",
            FixedType = (int)FacilityType.SwimmingArea,
        };
    }

    private static string GeoJson(params Site[] sites)
    {
        var features = sites.Select(s => new
        {
            type = "Feature",
            geometry = new { type = "Point", coordinates = new[] { s.Longitude, s.Latitude } },
            properties = new { place_id = s.PlaceId, name = s.Name, description = s.Description },
        });

        return JsonSerializer.Serialize(new { type = "FeatureCollection", features });
    }

    private static FacilityImportRequest Request(string sourceIdentifier, params Site[] sites)
    {
        return new FacilityImportRequest { SourceIdentifier = sourceIdentifier, GeoJson = GeoJson(sites), Mapping = BathingMapping() };
    }

    private static async Task<T> Read<T>(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<T>(TestContext.Current.CancellationToken);
        body.Should().NotBeNull();
        return body ?? throw new InvalidOperationException("expected a body");
    }

    [Fact]
    public async Task Preview_ListsEverySiteInTheFileAsNewBeforeTheFirstImport()
    {
        // Arrange
        var client = AdminClient();
        var boras = await SourceAsync(client, "Borås");

        // Act
        var response = await client.PostAsJsonAsync(PreviewRoute, Request(boras, Almenas, Asklanda), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var preview = await Read<FacilityImportPreviewResponse>(response);
        preview.Source.Should().Be("boras:badplatser");
        preview.Rows.Select(r => r.Name).Should().BeEquivalentTo(["Almenäs badplats", "Asklanda badplats"]);
        preview.Rows.Should().OnlyContain(r => r.Kind == FacilityImportRowKind.New);
        preview.HasWork.Should().BeTrue();
    }

    [Fact]
    public async Task Apply_CreatesTheFacilitiesAndASecondPreviewFindsNothingToDo()
    {
        // Arrange
        var client = AdminClient();
        var ct = TestContext.Current.CancellationToken;
        var boras = await SourceAsync(client, "Borås");

        // Act
        var response = await client.PostAsJsonAsync(ApplyRoute, Request(boras, Almenas, Asklanda), ct);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var applied = await Read<FacilityImportApplyResponse>(response);
        applied.Created.Should().Be(2);

        var all = await Read<List<AdminFacilityResponse>>(await client.GetAsync(FacilitiesRoute, ct));
        var almenas = all.Should().ContainSingle(f => f.Name == "Almenäs badplats").Subject;
        almenas.Latitude.Should().BeApproximately(57.7617761258m, 0.0000001m);
        almenas.Longitude.Should().BeApproximately(12.9396439434m, 0.0000001m);

        var again = await Read<FacilityImportPreviewResponse>(await client.PostAsJsonAsync(PreviewRoute, Request(boras, Almenas, Asklanda), ct));
        again.Rows.Should().HaveCount(2).And.OnlyContain(r => r.Kind == FacilityImportRowKind.Unchanged);
        again.HasWork.Should().BeFalse();
    }

    [Fact]
    public async Task Apply_TakesWhatTheSourceChangedOnTheNextImport()
    {
        // Arrange
        var client = AdminClient();
        var ct = TestContext.Current.CancellationToken;
        var boras = await SourceAsync(client, "Borås");
        (await client.PostAsJsonAsync(ApplyRoute, Request(boras, Almenas, Asklanda), ct)).EnsureSuccessStatusCode();
        var changed = Almenas with { Description = "Ny text från kommunen." };

        // Act
        var response = await client.PostAsJsonAsync(ApplyRoute, Request(boras, changed, Asklanda), ct);

        // Assert
        var applied = await Read<FacilityImportApplyResponse>(response);
        applied.Updated.Should().Be(1);
        applied.Unchanged.Should().Be(1);
        var all = await Read<List<AdminFacilityResponse>>(await client.GetAsync(FacilitiesRoute, ct));
        all.Should().ContainSingle(f => f.Name == "Almenäs badplats")
            .Which.Description.Should().Be("Ny text från kommunen.");
    }

    [Fact]
    public async Task Apply_KeepsAFieldTheAdminKeptAsTheWebSendsIt()
    {
        // Arrange
        var client = AdminClient();
        var ct = TestContext.Current.CancellationToken;
        var boras = await SourceAsync(client, "Borås");
        var gasered = new Site("1490-7001", "Gåsereds badplats", "Vår text om Gåsered.", 12.81, 57.70);
        (await client.PostAsJsonAsync(ApplyRoute, Request(boras, gasered), ct)).EnsureSuccessStatusCode();
        var body = JsonSerializer.Serialize(new
        {
            sourceIdentifier = boras,
            mapping = new { idField = "place_id", nameField = "name", descriptionField = "description", fixedType = (int)FacilityType.SwimmingArea },
            geoJson = GeoJson(gasered with { Description = "Kommunens nya text." }),
            kept = new[] { new { sourceId = "boras:badplatser:" + gasered.PlaceId, field = "Description" } },
        });

        // Act
        var response = await client.PostAsync(ApplyRoute, new StringContent(body, MediaTypeHeaderValue.Parse("application/json")), ct);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var all = await Read<List<AdminFacilityResponse>>(await client.GetAsync(FacilitiesRoute, ct));
        all.Should().ContainSingle(f => f.Name == "Gåsereds badplats")
            .Which.Description.Should().Be("Vår text om Gåsered.");
    }

    [Fact]
    public async Task Preview_KeepsAnotherMunicipalitysImportApart()
    {
        // Arrange
        var client = AdminClient();
        var ct = TestContext.Current.CancellationToken;
        var boras = await SourceAsync(client, "Borås");
        var ulricehamn = await SourceAsync(client, "Ulricehamn");
        (await client.PostAsJsonAsync(ApplyRoute, Request(boras, Almenas), ct)).EnsureSuccessStatusCode();
        var elsewhere = new Site("1491-1", "Strandbadet", null, 13.4, 57.79);

        // Act
        var response = await client.PostAsJsonAsync(PreviewRoute, Request(ulricehamn, elsewhere), ct);

        // Assert
        var preview = await Read<FacilityImportPreviewResponse>(response);
        preview.Source.Should().Be("ulricehamn:badplatser");
        preview.Rows.Should().ContainSingle().Which.Kind.Should().Be(FacilityImportRowKind.New);
    }

    [Fact]
    public async Task Preview_RefusesADataSourceThatIsNotInTheList()
    {
        // Arrange
        var client = AdminClient();

        // Act
        var response = await client.PostAsJsonAsync(PreviewRoute, Request("no-such-source", Almenas), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Apply_RefusesALinkToAnUnknownFacility()
    {
        // Arrange
        var client = AdminClient();
        var request = Request(await SourceAsync(client, "Borås"), Almenas);
        request.Links = [new FacilityImportLinkRequest { SourceId = "boras:badplatser:" + Almenas.PlaceId, FacilityIdentifier = "00000000-0000-0000-0000-000000000000" }];

        // Act
        var response = await client.PostAsJsonAsync(ApplyRoute, request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Apply_RejectsALinkWithoutASourceId()
    {
        // Arrange
        var client = AdminClient();
        var request = Request(await SourceAsync(client, "Borås"), Almenas);
        request.Links = [new FacilityImportLinkRequest { SourceId = "", FacilityIdentifier = "x" }];

        // Act
        var response = await client.PostAsJsonAsync(ApplyRoute, request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Preview_RejectsAFileThatIsNotGeoJson()
    {
        // Arrange
        var client = AdminClient();
        var request = new FacilityImportRequest
        {
            SourceIdentifier = await SourceAsync(client, "Borås"),
            GeoJson = "place_id;name\n1;Almenäs",
            Mapping = BathingMapping(),
        };

        // Act
        var response = await client.PostAsJsonAsync(PreviewRoute, request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).Should().Contain("not valid GeoJSON");
    }

    [Fact]
    public async Task Preview_RejectsAFileWithoutFacilities()
    {
        // Arrange
        var client = AdminClient();

        // Act
        var response = await client.PostAsJsonAsync(PreviewRoute, Request(await SourceAsync(client, "Borås")), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).Should().Contain("No feature in the file");
    }

    private static FacilityImportRequest OutdoorRequest(string sourceIdentifier, string place = "Kypesjön", double shift = 0)
    {
        var features = new[]
        {
            (Typ: "Grillplats", Namn: $"{place} - grillplats", Longitude: 12.9801, Latitude: 57.7302),
            (Typ: "Vindskydd", Namn: $"{place} - vindskydd", Longitude: 12.9812, Latitude: 57.7310),
            (Typ: "Toalett", Namn: $"{place} - toalett", Longitude: 12.9820, Latitude: 57.7320),
        }.Select(f => new
        {
            type = "Feature",
            geometry = new { type = "Point", coordinates = new[] { f.Longitude, f.Latitude + shift } },
            properties = new { typ = f.Typ, namn = f.Namn },
        });

        return new FacilityImportRequest
        {
            SourceIdentifier = sourceIdentifier,
            GeoJson = JsonSerializer.Serialize(new { type = "FeatureCollection", features }),
            Mapping = new FacilityImportMappingRequest
            {
                NameField = "namn",
                TypeField = "typ",
                TypeValues =
                [
                    new FacilityImportTypeValueRequest { Value = "Grillplats", FacilityType = (int)FacilityType.FirePit },
                    new FacilityImportTypeValueRequest { Value = "Vindskydd", FacilityType = (int)FacilityType.Shelter },
                    new FacilityImportTypeValueRequest { Value = "Toalett", FacilityType = 0 },
                ],
            },
        };
    }

    [Fact]
    public async Task Apply_ImportsEachTypeAndRecognisesAFileWithoutIdsByPosition()
    {
        // Arrange
        var client = AdminClient();
        var ct = TestContext.Current.CancellationToken;
        var source = await SourceAsync(client, "Borås", "Friluftsanläggningar");

        // Act
        var applied = await Read<FacilityImportApplyResponse>(await client.PostAsJsonAsync(ApplyRoute, OutdoorRequest(source), ct));
        var again = await Read<FacilityImportPreviewResponse>(await client.PostAsJsonAsync(PreviewRoute, OutdoorRequest(source, shift: 0.00002), ct));

        // Assert
        applied.Created.Should().Be(2);
        var all = await Read<List<AdminFacilityResponse>>(await client.GetAsync(FacilitiesRoute, ct));
        all.Single(f => f.Name == "Kypesjön - grillplats").FacilityType.Should().Be((int)FacilityType.FirePit);
        all.Single(f => f.Name == "Kypesjön - vindskydd").FacilityType.Should().Be((int)FacilityType.Shelter);
        all.Should().NotContain(f => f.Name == "Kypesjön - toalett");
        again.Rows.Should().HaveCount(2).And.OnlyContain(r => r.Kind == FacilityImportRowKind.Changed);
    }

    [Fact]
    public async Task Apply_SavesTheMappingOnTheDataSource()
    {
        // Arrange
        var client = AdminClient();
        var ct = TestContext.Current.CancellationToken;
        var source = await SourceAsync(client, "Borås", "Vindskydd");

        // Act
        (await client.PostAsJsonAsync(ApplyRoute, OutdoorRequest(source, place: "Kärrabadet"), ct)).EnsureSuccessStatusCode();

        // Assert
        var sources = await Read<List<FacilityImportSourceResponse>>(await client.GetAsync(SourcesRoute, ct));
        var mapping = sources.Single(s => s.Identifier == source).Mapping;
        mapping.Should().NotBeNull();
        if (mapping is null) throw new InvalidOperationException("expected a mapping");
        mapping.NameField.Should().Be("namn");
        mapping.IdField.Should().BeNull();
        mapping.TypeValues.Should().ContainEquivalentOf(new FacilityImportTypeValueResponse { Value = "Vindskydd", FacilityType = (int)FacilityType.Shelter });
    }

    [Fact]
    public async Task Preview_RefusesAnotherIdFieldOnceFacilitiesAreImported()
    {
        // Arrange
        var client = AdminClient();
        var ct = TestContext.Current.CancellationToken;
        var source = await SourceAsync(client, "Borås", "Rastplatser");
        (await client.PostAsJsonAsync(ApplyRoute, OutdoorRequest(source, place: "Rammsjön"), ct)).EnsureSuccessStatusCode();
        var byName = OutdoorRequest(source, place: "Rammsjön");
        byName.Mapping.IdField = "namn";

        // Act
        var response = await client.PostAsJsonAsync(PreviewRoute, byName, ct);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(ct)).Should().Contain("Rastplatser has facilities matched on position");
    }

    [Fact]
    public async Task Preview_SaysWhatTheReaderChanged()
    {
        // Arrange
        var client = AdminClient();
        var request = Request(await SourceAsync(client, "Borås"), Almenas);
        request.GeoJson = request.GeoJson.Replace("\"description\":", "\"visit_url\":\"www.boras.se\",\"description\":", StringComparison.Ordinal);
        request.Mapping.UrlField = "visit_url";

        // Act
        var preview = await Read<FacilityImportPreviewResponse>(await client.PostAsJsonAsync(PreviewRoute, request, TestContext.Current.CancellationToken));

        // Assert
        preview.Notes.Should().ContainSingle().Which.Should().Contain("\"www.boras.se\" is not a full web address");
    }

    [Fact]
    public async Task Preview_RefusesATypeValueTheMappingLeavesOut()
    {
        // Arrange
        var client = AdminClient();
        var request = OutdoorRequest(await SourceAsync(client, "Borås", "Friluftsanläggningar"));
        request.Mapping.TypeValues = request.Mapping.TypeValues.Where(v => v.Value != "Toalett").ToList();

        // Act
        var response = await client.PostAsJsonAsync(PreviewRoute, request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).Should().Contain("Toalett");
    }

    [Fact]
    public async Task Preview_RequiresATypeWhenTheFileHasNoTypeField()
    {
        // Arrange
        var client = AdminClient();
        var request = Request(await SourceAsync(client, "Borås"), Almenas);
        request.Mapping.FixedType = 0;

        // Act
        var response = await client.PostAsJsonAsync(PreviewRoute, request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
