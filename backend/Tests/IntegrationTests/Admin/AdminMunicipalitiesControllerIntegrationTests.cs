// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.Municipality;
using WebDataContracts.ResponseModels.Municipality;

namespace IntegrationTests.Admin;

public class AdminMunicipalitiesControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string Route = "/api/v1/admin/municipalities";
    private const string AuthenticatedUser = "firebase-uid-12346"; // VandrarVennen

    public AdminMunicipalitiesControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
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

    private static Task<HttpResponseMessage> Add(HttpClient client, string name)
    {
        return client.PostAsJsonAsync(Route, new CreateMunicipalityRequest { Name = name }, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Create_DerivesTheSlugFromTheName()
    {
        // Arrange
        var client = AdminClient();

        // Act
        var response = await Add(client, "  Upplands Väsby ");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var created = await response.Content.ReadFromJsonAsync<MunicipalityResponse>(TestContext.Current.CancellationToken);
        created.Should().NotBeNull();
        created?.Name.Should().Be("Upplands Väsby");
        created?.Slug.Should().Be("upplands-vasby");
    }

    [Fact]
    public async Task Create_RefusesASecondMunicipalityWithTheSameSlug()
    {
        // Arrange
        var client = AdminClient();
        (await Add(client, "Herrljunga")).EnsureSuccessStatusCode();

        // Act
        var response = await Add(client, "herrljunga");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Create_RejectsANameWithoutLettersOrDigits()
    {
        // Arrange
        var client = AdminClient();

        // Act
        var response = await Add(client, " - ");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetAll_ListsTheAddedMunicipalities()
    {
        // Arrange
        var client = AdminClient();
        (await Add(client, "Tranemo")).EnsureSuccessStatusCode();

        // Act
        var all = await client.GetFromJsonAsync<List<MunicipalityResponse>>(Route, TestContext.Current.CancellationToken);

        // Assert
        all.Should().NotBeNull();
        all.Should().ContainSingle(m => m.Name == "Tranemo");
    }
}
