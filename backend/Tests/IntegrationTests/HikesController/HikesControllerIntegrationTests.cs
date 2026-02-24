using FluentAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;

namespace IntegrationTests.HikesController;

public class HikesControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string AUTHENTICATED_USER = "firebase-uid-123456";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public HikesControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    [Fact]
    public async Task GetHikeByIdentifierAsync_ShouldReturnHike_WhenExists()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        var hikeIdentifier = "3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90";
        
        // Act
        var response = await client.GetAsync($"/api/v1/hikes/{hikeIdentifier}");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }































}