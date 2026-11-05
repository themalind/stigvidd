// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using WebDataContracts.RequestModels.Facility;
using WebDataContracts.ResponseModels.Facility;

namespace IntegrationTests.Admin;

public class AdminFacilitiesControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string FacilitiesRoute = "/api/v1/admin/facilities";

    private const string AuthenticatedUser = "firebase-uid-12346"; // VandrarVennen

    private const string Facility1Identifier = "fac1a1b2-c3d4-4e5f-6a7b-8c9d0e1f2a3b"; // Grillplats Tiveden
    private const string Facility2Identifier = "fac2b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // Vindskydd Gesebol
    private const string NonExistentIdentifier = "00000000-0000-0000-0000-000000000000";

    public AdminFacilitiesControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
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

    private static SaveFacilityRequest Valid(
        string name = "Ny grillplats",
        decimal? latitude = 57.7m,
        decimal? longitude = 12.8m,
        string description = "",
        string url = "")
    {
        return new SaveFacilityRequest
        {
            Name = name,
            FacilityType = 1,
            IsAccessible = true,
            Latitude = latitude,
            Longitude = longitude,
            Location = "",
            Description = description,
            Url = url,
        };
    }

    private static StringContent Json(string body)
    {
        return new StringContent(body, Encoding.UTF8, "application/json");
    }

    private async Task<AdminFacilityResponse> ReadBack(HttpClient client, string identifier)
    {
        var all = await client.GetFromJsonAsync<List<AdminFacilityResponse>>(FacilitiesRoute, TestContext.Current.CancellationToken);
        all.Should().NotBeNull();
        return all.Should().ContainSingle(f => f.Identifier == identifier).Subject;
    }

    [Fact]
    public async Task Create_WithAdminRole_SavesEveryField()
    {
        // Arrange
        var client = AdminClient();
        var request = Valid(description: "Grillplats med ved.", url: "https://www.boras.se/grill");

        // Act
        var response = await client.PostAsJsonAsync(FacilitiesRoute, request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var created = await response.Content.ReadFromJsonAsync<AdminFacilityResponse>(TestContext.Current.CancellationToken);
        created.Should().NotBeNull();
        var stored = await ReadBack(client, created.Identifier);
        stored.Name.Should().Be("Ny grillplats");
        stored.FacilityType.Should().Be(1);
        stored.Latitude.Should().Be(57.7m);
        stored.Longitude.Should().Be(12.8m);
        stored.Description.Should().Be("Grillplats med ved.");
        stored.Url.Should().Be("https://www.boras.se/grill");
        stored.Location.Should().Be("");
    }

    [Fact]
    public async Task Create_WithoutAuthentication_ShouldReturnUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsJsonAsync(FacilitiesRoute, Valid(), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    public static TheoryData<string, decimal?, decimal?, string> InvalidCreates => new()
    {
        { "", 57.7m, 12.8m, "" },
        { "Grillplats", 91m, 12.8m, "" },
        { "Grillplats", 57.7m, 181m, "" },
        { "Grillplats", 57.7m, null, "" },
        { "Grillplats", 57.7m, 12.8m, "boras.se" },
        { "Grillplats", 57.7m, 12.8m, "javascript:alert(1)" },
    };

    [Theory]
    [MemberData(nameof(InvalidCreates))]
    public async Task Create_WithAnInvalidField_ShouldReturnBadRequest(string name, decimal? latitude, decimal? longitude, string url)
    {
        // Act
        var response = await AdminClient().PostAsJsonAsync(
            FacilitiesRoute, Valid(name, latitude, longitude, url: url), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Create_WithAMissingField_ShouldReturnBadRequest()
    {
        // Arrange
        const string withoutDescription =
            """{"name":"Grillplats","facilityType":1,"isAccessible":true,"latitude":57.7,"longitude":12.8,"location":"","url":""}""";

        // Act
        var response = await AdminClient().PostAsync(FacilitiesRoute, Json(withoutDescription), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Update_WithAnUnknownField_ShouldReturnBadRequestAndChangeNothing()
    {
        // Arrange
        var client = AdminClient();
        const string withExtra =
            """{"name":"Nytt namn","facilityType":2,"isAccessible":true,"latitude":null,"longitude":null,"location":"","description":"","url":"","imageUrl":"x.jpg"}""";

        // Act
        var response = await client.PutAsync($"{FacilitiesRoute}/{Facility2Identifier}", Json(withExtra), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ReadBack(client, Facility2Identifier)).Name.Should().Be("Vindskydd Gesebol");
    }

    [Fact]
    public async Task Update_WithAdminRole_ReplacesEveryField()
    {
        // Arrange
        var client = AdminClient();
        var request = Valid("Uppdaterat namn", description: "Två vindskydd vid stranden.", url: "https://www.boras.se/gesebol");

        // Act
        var response = await client.PutAsJsonAsync($"{FacilitiesRoute}/{Facility2Identifier}", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var stored = await ReadBack(client, Facility2Identifier);
        stored.Name.Should().Be("Uppdaterat namn");
        stored.FacilityType.Should().Be(1);
        stored.Description.Should().Be("Två vindskydd vid stranden.");
        stored.Url.Should().Be("https://www.boras.se/gesebol");
        stored.Latitude.Should().Be(57.7m);
        stored.Longitude.Should().Be(12.8m);
    }

    [Fact]
    public async Task Update_WithoutCoordinates_RemovesThePoint()
    {
        // Arrange
        var client = AdminClient();

        // Act
        var response = await client.PutAsJsonAsync(
            $"{FacilitiesRoute}/{Facility2Identifier}", Valid(latitude: null, longitude: null), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var stored = await ReadBack(client, Facility2Identifier);
        stored.Latitude.Should().BeNull();
        stored.Longitude.Should().BeNull();
    }

    [Fact]
    public async Task Update_WithoutAuthentication_ShouldReturnUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.PutAsJsonAsync($"{FacilitiesRoute}/{Facility1Identifier}", Valid(), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Update_WithNonExistentFacility_ShouldReturnNotFound()
    {
        // Act
        var response = await AdminClient().PutAsJsonAsync(
            $"{FacilitiesRoute}/{NonExistentIdentifier}", Valid(), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Update_WithInvalidLatitude_ShouldReturnBadRequest()
    {
        // Act
        var response = await AdminClient().PutAsJsonAsync(
            $"{FacilitiesRoute}/{Facility1Identifier}", Valid(latitude: 91m), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Delete_WithAdminRole_ShouldReturnNoContent()
    {
        // Act
        var response = await AdminClient().DeleteAsync($"{FacilitiesRoute}/{Facility1Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Delete_WithoutAuthentication_ShouldReturnUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.DeleteAsync($"{FacilitiesRoute}/{Facility1Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Delete_WithNonExistentFacility_ShouldReturnNotFound()
    {
        // Act
        var response = await AdminClient().DeleteAsync($"{FacilitiesRoute}/{NonExistentIdentifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
