using FluentAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Json;
using WebDataContracts.ResponseModels.CityArea;

namespace IntegrationTests.CityAreasController;

public class CityAreasControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string LinkedAreaIdentifier = "area-dalsjofors";
    private const string EmptyAreaIdentifier = "area-viskafors";
    private const string NonExistentIdentifier = "00000000-0000-0000-0000-000000000000";

    public CityAreasControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    [Fact]
    public async Task GetAll_WhenCityAreasExist_ShouldReturnOk()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/v1/cityareas", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetAll_ShouldReturnAllSeededCityAreas()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/v1/cityareas", TestContext.Current.CancellationToken);
        var cityAreas = await response.Content.ReadFromJsonAsync<List<CityAreaResponse>>(TestContext.Current.CancellationToken);

        // Assert
        cityAreas.Should().NotBeNull().And.HaveCount(2);
    }

    [Fact]
    public async Task GetAll_WithoutAuthentication_ShouldReturnOk()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = null;

        // Act
        var response = await client.GetAsync("/api/v1/cityareas", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetByIdentifier_WhenFound_ShouldReturnLinkedFacilitiesAndTrails()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"/api/v1/cityareas/{LinkedAreaIdentifier}", TestContext.Current.CancellationToken);
        var area = await response.Content.ReadFromJsonAsync<CityAreaResponse>(TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        area.Should().NotBeNull();
        area!.Identifier.Should().Be(LinkedAreaIdentifier);
        area.Name.Should().Be("Dalsjöfors");
        area.Facilities.Should().HaveCount(2);
        area.Trails.Should().ContainSingle(t => t.Name == "Tiveden");
    }

    [Fact]
    public async Task GetByIdentifier_WhenAreaHasNoLinks_ShouldReturnEmptyCollections()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"/api/v1/cityareas/{EmptyAreaIdentifier}", TestContext.Current.CancellationToken);
        var area = await response.Content.ReadFromJsonAsync<CityAreaResponse>(TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        area.Should().NotBeNull();
        area!.Facilities.Should().BeEmpty();
        area.Trails.Should().BeEmpty();
    }

    [Fact]
    public async Task GetByIdentifier_WhenNotFound_ShouldReturnNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"/api/v1/cityareas/{NonExistentIdentifier}", TestContext.Current.CancellationToken);

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
        var response = await client.GetAsync($"/api/v1/cityareas/{LinkedAreaIdentifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetFacilities_ShouldExcludeCoordinateLessFacilities()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act — the coordinate-less fishing facility owned by the Dalsjöfors area must not appear
        // as a map marker, so the /facilities endpoint still returns only the two seeded markers.
        var response = await client.GetAsync("/api/v1/facilities", TestContext.Current.CancellationToken);
        var facilities = await response.Content.ReadFromJsonAsync<List<WebDataContracts.ResponseModels.Facility.FacilityResponse>>(TestContext.Current.CancellationToken);

        // Assert
        facilities.Should().NotBeNull().And.HaveCount(2);
        facilities.Should().NotContain(f => f.Identifier == "fac-fishing-ankedammen");
    }
}
