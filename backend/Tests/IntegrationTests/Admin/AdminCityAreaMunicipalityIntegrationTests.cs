// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.CityArea;
using WebDataContracts.RequestModels.Municipality;
using WebDataContracts.ResponseModels.CityArea;
using WebDataContracts.ResponseModels.Municipality;

namespace IntegrationTests.Admin;

public class AdminCityAreaMunicipalityIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string Route = "/api/v1/admin/city-areas";
    private const string AuthenticatedUser = "firebase-uid-12346";
    private const string Area = "area-viskafors";

    public AdminCityAreaMunicipalityIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private HttpClient CreateAdminClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, TestAuthHandler.AdminRole);
        return client;
    }

    private static async Task<MunicipalityResponse> CreateMunicipalityAsync(HttpClient client, string name)
    {
        var created = await client.PostAsJsonAsync(
            "/api/v1/admin/municipalities", new CreateMunicipalityRequest { Name = name }, TestContext.Current.CancellationToken);
        created.EnsureSuccessStatusCode();
        var municipality = await created.Content.ReadFromJsonAsync<MunicipalityResponse>(TestContext.Current.CancellationToken);
        municipality.Should().NotBeNull();
        return municipality;
    }

    private static async Task<T> SingleAreaAsync<T>(HttpClient client, string route, Func<T, string> identifier)
    {
        var areas = await client.GetFromJsonAsync<List<T>>(route, TestContext.Current.CancellationToken);
        areas.Should().NotBeNull();
        var area = areas.SingleOrDefault(a => identifier(a) == Area);
        area.Should().NotBeNull();
        return area;
    }

    [Fact]
    public async Task SetMunicipality_ShowsInTheAdminListAndThePublicList_AndNullClearsIt()
    {
        // Arrange
        var client = CreateAdminClient();
        var ct = TestContext.Current.CancellationToken;
        var municipality = await CreateMunicipalityAsync(client, "Mark");

        // Act
        var set = await client.PutAsJsonAsync(
            $"{Route}/{Area}/municipality", new SetCityAreaMunicipalityRequest { MunicipalityIdentifier = municipality.Identifier }, ct);
        var admin = await SingleAreaAsync<AdminCityAreaResponse>(client, Route, a => a.Identifier);
        var published = await SingleAreaAsync<CityAreaResponse>(client, "/api/v1/cityareas", a => a.Identifier);
        var cleared = await client.PutAsJsonAsync($"{Route}/{Area}/municipality", new SetCityAreaMunicipalityRequest(), ct);
        var afterClearing = await SingleAreaAsync<AdminCityAreaResponse>(client, Route, a => a.Identifier);

        // Assert
        set.StatusCode.Should().Be(HttpStatusCode.NoContent);
        admin.MunicipalityIdentifier.Should().Be(municipality.Identifier);
        published.Municipality.Should().Be("Mark");
        cleared.StatusCode.Should().Be(HttpStatusCode.NoContent);
        afterClearing.MunicipalityIdentifier.Should().BeNull();
    }

    [Fact]
    public async Task SetMunicipality_WithAnUnknownMunicipality_Returns404AndKeepsTheArea()
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var response = await client.PutAsJsonAsync(
            $"{Route}/{Area}/municipality",
            new SetCityAreaMunicipalityRequest { MunicipalityIdentifier = "no-such-municipality" },
            TestContext.Current.CancellationToken);
        var area = await SingleAreaAsync<AdminCityAreaResponse>(client, Route, a => a.Identifier);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        area.MunicipalityIdentifier.Should().BeNull();
    }
}
