using FluentAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.Facility;
using WebDataContracts.ResponseModels.Facility;

namespace IntegrationTests.FacilitiesController;

public class FacilitiesControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string UpdateRoute = "/api/v1/facilities/update";

    private const string AuthenticatedUser = "firebase-uid-12346"; // VandrarVennen

    private const string Facility1Identifier = "fac1a1b2-c3d4-4e5f-6a7b-8c9d0e1f2a3b"; // Grillplats Tiveden
    private const string Facility2Identifier = "fac2b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // Vindskydd Gesebol
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
        facility!.Identifier.Should().Be(Facility1Identifier);
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

    [Fact]
    public async Task Create_WithAuthenticatedUser_ShouldReturnOk()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var request = new CreateFacilityRequest
        {
            Name = "Ny grillplats",
            FacilityType = 1,
            IsAccessible = true,
            Latitude = 57.7m,
            Longitude = 12.8m
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/facilities", request, TestContext.Current.CancellationToken);
        var facility = await response.Content.ReadFromJsonAsync<FacilityResponse>(TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        facility.Should().NotBeNull();
        facility!.Name.Should().Be("Ny grillplats");
        facility.FacilityType.Should().Be(1);
    }

    [Fact]
    public async Task Create_WithoutAuthentication_ShouldReturnUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = null;

        var request = new CreateFacilityRequest
        {
            Name = "Ny grillplats",
            FacilityType = 1,
            IsAccessible = true,
            Latitude = 57.7m,
            Longitude = 12.8m
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/facilities", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Create_WithEmptyName_ShouldReturnBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var request = new CreateFacilityRequest
        {
            Name = string.Empty,
            FacilityType = 1,
            IsAccessible = true,
            Latitude = 57.7m,
            Longitude = 12.8m
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/facilities", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Create_WithLatitudeOutOfRange_ShouldReturnBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var request = new CreateFacilityRequest
        {
            Name = "Grillplats",
            FacilityType = 1,
            IsAccessible = true,
            Latitude = 91m,
            Longitude = 12.8m
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/facilities", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Create_WithLongitudeOutOfRange_ShouldReturnBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var request = new CreateFacilityRequest
        {
            Name = "Grillplats",
            FacilityType = 1,
            IsAccessible = true,
            Latitude = 57.7m,
            Longitude = 181m
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/facilities", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Update_WithAuthenticatedUser_ShouldReturnOk()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var request = new UpdateFacilityRequest { Name = "Uppdaterat namn" };

        // Act
        var response = await client.PutAsJsonAsync($"{UpdateRoute}/{Facility2Identifier}", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var facility = await response.Content.ReadFromJsonAsync<FacilityResponse>(TestContext.Current.CancellationToken);
        facility.Should().NotBeNull();
        facility!.Name.Should().Be("Uppdaterat namn");
    }

    [Fact]
    public async Task Update_WithoutAuthentication_ShouldReturnUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = null;

        var request = new UpdateFacilityRequest { Name = "Uppdaterat namn" };

        // Act
        var response = await client.PutAsJsonAsync($"{UpdateRoute}/{Facility1Identifier}", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Update_WithNonExistentFacility_ShouldReturnNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var request = new UpdateFacilityRequest { Name = "Uppdaterat namn" };

        // Act
        var response = await client.PutAsJsonAsync($"{UpdateRoute}/{NonExistentIdentifier}", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Update_WithInvalidLatitude_ShouldReturnBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var request = new UpdateFacilityRequest { Latitude = 91 };

        // Act
        var response = await client.PutAsJsonAsync($"{UpdateRoute}/{Facility1Identifier}", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Delete_WithAuthenticatedUser_ShouldReturnNoContent()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.DeleteAsync($"/api/v1/facilities/{Facility1Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Delete_WithoutAuthentication_ShouldReturnUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = null;

        // Act
        var response = await client.DeleteAsync($"/api/v1/facilities/{Facility1Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Delete_WithNonExistentFacility_ShouldReturnNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.DeleteAsync($"/api/v1/facilities/{NonExistentIdentifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
