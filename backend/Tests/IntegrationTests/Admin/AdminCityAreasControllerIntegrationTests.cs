// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.ResponseModels.CityArea;
using WebDataContracts.ResponseModels.Facility;

namespace IntegrationTests.Admin;

public class AdminCityAreasControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string Route = "/api/v1/admin/city-areas";
    private const string AuthenticatedUser = "firebase-uid-12346";

    private const string LinkedArea = "area-dalsjofors";
    private const string EmptyArea = "area-viskafors";
    private const string Firepit = "fac1a1b2-c3d4-4e5f-6a7b-8c9d0e1f2a3b";
    private const string Shelter = "fac2b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
    private const string FishingArea = "fac-fishing-ankedammen";
    private const string NonExistent = "00000000-0000-0000-0000-000000000000";

    public AdminCityAreasControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
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

    private async Task<AdminCityAreaResponse> GetAreaAsync(HttpClient client, string identifier)
    {
        var areas = await client.GetFromJsonAsync<List<AdminCityAreaResponse>>(Route, TestContext.Current.CancellationToken);
        areas.Should().NotBeNull();
        var area = areas.SingleOrDefault(a => a.Identifier == identifier);
        area.Should().NotBeNull();
        return area;
    }

    [Fact]
    public async Task GetAll_ReturnsLinkedFacilitiesAndTrails()
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var area = await GetAreaAsync(client, LinkedArea);
        var empty = await GetAreaAsync(client, EmptyArea);

        // Assert
        area.Facilities.Select(f => f.Identifier).Should().BeEquivalentTo([Firepit, FishingArea]);
        area.Trails.Should().ContainSingle().Which.Identifier.Should().NotBeNullOrEmpty();
        empty.Facilities.Should().BeEmpty();
        empty.Trails.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAll_WithoutAdminRole_ReturnsForbidden()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.GetAsync(Route, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task LinkFacility_AddsItToTheArea_AndIsIdempotent()
    {
        // Arrange
        var client = CreateAdminClient();
        var url = $"{Route}/{EmptyArea}/facilities/{Shelter}";

        // Act
        var first = await client.PutAsync(url, null, TestContext.Current.CancellationToken);
        var second = await client.PutAsync(url, null, TestContext.Current.CancellationToken);
        var area = await GetAreaAsync(client, EmptyArea);

        // Assert
        first.StatusCode.Should().Be(HttpStatusCode.NoContent);
        second.StatusCode.Should().Be(HttpStatusCode.NoContent);
        area.Facilities.Should().ContainSingle().Which.Identifier.Should().Be(Shelter);
    }

    [Fact]
    public async Task UnlinkFacility_RemovesOnlyThatLink()
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var response = await client.DeleteAsync($"{Route}/{LinkedArea}/facilities/{Firepit}", TestContext.Current.CancellationToken);
        var area = await GetAreaAsync(client, LinkedArea);
        var facilities = await client.GetFromJsonAsync<List<FacilityResponse>>("/api/v1/admin/facilities", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        area.Facilities.Select(f => f.Identifier).Should().BeEquivalentTo([FishingArea]);
        facilities.Should().NotBeNull();
        facilities.Select(f => f.Identifier).Should().Contain(Firepit);
    }

    [Fact]
    public async Task LinkAndUnlinkTrail_UpdatesTheArea()
    {
        // Arrange
        var client = CreateAdminClient();
        var linked = await GetAreaAsync(client, LinkedArea);
        var trail = linked.Trails.Single().Identifier;

        // Act
        var link = await client.PutAsync($"{Route}/{EmptyArea}/trails/{trail}", null, TestContext.Current.CancellationToken);
        var unlink = await client.DeleteAsync($"{Route}/{LinkedArea}/trails/{trail}", TestContext.Current.CancellationToken);
        var empty = await GetAreaAsync(client, EmptyArea);
        var formerlyLinked = await GetAreaAsync(client, LinkedArea);

        // Assert
        link.StatusCode.Should().Be(HttpStatusCode.NoContent);
        unlink.StatusCode.Should().Be(HttpStatusCode.NoContent);
        empty.Trails.Should().ContainSingle().Which.Identifier.Should().Be(trail);
        formerlyLinked.Trails.Should().BeEmpty();
    }

    [Theory]
    [InlineData(NonExistent, Firepit)]
    [InlineData(LinkedArea, NonExistent)]
    public async Task LinkFacility_WithUnknownAreaOrFacility_ReturnsNotFound(string area, string facility)
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var response = await client.PutAsync($"{Route}/{area}/facilities/{facility}", null, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task LinkTrail_WithUnknownTrail_ReturnsNotFound()
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var response = await client.PutAsync($"{Route}/{EmptyArea}/trails/{NonExistent}", null, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task AdminFacilities_IncludesFacilitiesWithoutCoordinates()
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var facilities = await client.GetFromJsonAsync<List<FacilityResponse>>("/api/v1/admin/facilities", TestContext.Current.CancellationToken);

        // Assert
        facilities.Should().NotBeNull();
        facilities.Select(f => f.Identifier).Should().BeEquivalentTo([Firepit, Shelter, FishingArea]);
    }
}
