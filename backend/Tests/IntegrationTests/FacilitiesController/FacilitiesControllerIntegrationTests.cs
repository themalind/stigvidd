// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Json;
using WebDataContracts.ResponseModels.Facility;

namespace IntegrationTests.FacilitiesController;

public class FacilitiesControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string Facility1Identifier = "fac1a1b2-c3d4-4e5f-6a7b-8c9d0e1f2a3b"; // Grillplats Tiveden
    private const string NonExistentIdentifier = "00000000-0000-0000-0000-000000000000";

    public FacilitiesControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    [Fact]
    public async Task GetAll_WhenFacilitiesExist_ShouldReturnOk()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/v1/facilities", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetAll_ShouldReturnAllSeededFacilities()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/v1/facilities", TestContext.Current.CancellationToken);
        var facilities = await response.Content.ReadFromJsonAsync<List<FacilityResponse>>(TestContext.Current.CancellationToken);

        // Assert
        facilities.Should().NotBeNull().And.HaveCount(2);
    }

    [Fact]
    public async Task GetAll_WithoutAuthentication_ShouldReturnOk()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = null;

        // Act
        var response = await client.GetAsync("/api/v1/facilities", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetByIdentifier_WhenFound_ShouldReturnOk()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"/api/v1/facilities/{Facility1Identifier}", TestContext.Current.CancellationToken);
        var facility = await response.Content.ReadFromJsonAsync<FacilityResponse>(TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        facility.Should().NotBeNull();
        facility.Identifier.Should().Be(Facility1Identifier);
        facility.Name.Should().Be("Grillplats Tiveden");
    }

    [Fact]
    public async Task GetByIdentifier_WhenNotFound_ShouldReturnNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"/api/v1/facilities/{NonExistentIdentifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetByIdentifier_WithoutAuthentication_ShouldReturnOk()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = null;

        // Act
        var response = await client.GetAsync($"/api/v1/facilities/{Facility1Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
