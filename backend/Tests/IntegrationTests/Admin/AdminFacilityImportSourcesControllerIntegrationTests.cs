// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.Facility;
using WebDataContracts.RequestModels.Municipality;
using WebDataContracts.ResponseModels.Facility;
using WebDataContracts.ResponseModels.Municipality;

namespace IntegrationTests.Admin;

public class AdminFacilityImportSourcesControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string Route = "/api/v1/admin/facilities/import/sources";
    private const string MunicipalitiesRoute = "/api/v1/admin/municipalities";
    private const string AuthenticatedUser = "firebase-uid-12346"; // VandrarVennen

    public AdminFacilityImportSourcesControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
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

    private static async Task<T> Read<T>(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<T>(TestContext.Current.CancellationToken);
        body.Should().NotBeNull();
        return body ?? throw new InvalidOperationException("expected a body");
    }

    private static async Task<MunicipalityResponse> MunicipalityAsync(HttpClient client, string name)
    {
        var ct = TestContext.Current.CancellationToken;
        var existing = await Read<List<MunicipalityResponse>>(await client.GetAsync(MunicipalitiesRoute, ct));

        if (existing.Find(m => m.Name == name) is { } found)
            return found;

        return await Read<MunicipalityResponse>(await client.PostAsJsonAsync(MunicipalitiesRoute, new CreateMunicipalityRequest { Name = name }, ct));
    }

    [Fact]
    public async Task Create_KeysTheSourceByMunicipalityAndName()
    {
        // Arrange
        var client = AdminClient();
        var mark = await MunicipalityAsync(client, "Mark");

        // Act
        var response = await client.PostAsJsonAsync(
            Route, new CreateFacilityImportSourceRequest { MunicipalityIdentifier = mark.Identifier, Name = " Grillplatser och vindskydd " },
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var source = await Read<FacilityImportSourceResponse>(response);
        source.Name.Should().Be("Grillplatser och vindskydd");
        source.Key.Should().Be("mark:grillplatser-och-vindskydd");
        source.MunicipalityName.Should().Be("Mark");
        source.Mapping.Should().BeNull();
    }

    [Fact]
    public async Task Create_RefusesASecondSourceWithTheSameName()
    {
        // Arrange
        var client = AdminClient();
        var ct = TestContext.Current.CancellationToken;
        var tranemo = await MunicipalityAsync(client, "Tranemo");
        var request = new CreateFacilityImportSourceRequest { MunicipalityIdentifier = tranemo.Identifier, Name = "Badplatser" };
        (await client.PostAsJsonAsync(Route, request, ct)).EnsureSuccessStatusCode();

        // Act
        var response = await client.PostAsJsonAsync(Route, request, ct);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Create_RefusesAMunicipalityThatIsNotInTheList()
    {
        // Arrange
        var client = AdminClient();

        // Act
        var response = await client.PostAsJsonAsync(
            Route, new CreateFacilityImportSourceRequest { MunicipalityIdentifier = "no-such-municipality", Name = "Badplatser" },
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetAll_ListsTheSourcesWithTheirMunicipality()
    {
        // Arrange
        var client = AdminClient();
        var ct = TestContext.Current.CancellationToken;
        var svenljunga = await MunicipalityAsync(client, "Svenljunga");
        await client.PostAsJsonAsync(Route, new CreateFacilityImportSourceRequest { MunicipalityIdentifier = svenljunga.Identifier, Name = "Badplatser" }, ct);

        // Act
        var sources = await Read<List<FacilityImportSourceResponse>>(await client.GetAsync(Route, ct));

        // Assert
        sources.Should().Contain(s => s.Key == "svenljunga:badplatser" && s.MunicipalityIdentifier == svenljunga.Identifier);
    }
}
