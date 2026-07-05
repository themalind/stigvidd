using FluentAssertions;
using ImageMagick;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.ResponseModels.Media;
using WebDataContracts.ResponseModels.Trail;

namespace IntegrationTests.MediaController;

public class MediaControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string AuthenticatedUser = "firebase-uid-12346"; // User 2: VandrarVennen
    private const string StorsjoledenIdentifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // Trail 2

    public MediaControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private static byte[] MakePng(uint width, uint height)
    {
        using var image = new MagickImage(new MagickColor("#112233"), width, height);
        image.Format = MagickFormat.Png;
        return image.ToByteArray();
    }

    private static MultipartFormDataContent BuildImageUpload(byte[] imageBytes)
    {
        var imageContent = new ByteArrayContent(imageBytes);
        imageContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");

        return new MultipartFormDataContent
        {
            { imageContent, "images", "photo.png" },
            { new StringContent("100"), "MaxWidth" },
            { new StringContent("100"), "MaxHeight" },
            { new StringContent("70"), "Quality" },
            { new StringContent("webp"), "Format" },
        };
    }

    [Fact]
    public async Task AddTrailImages_WithRealImageAndOptions_ResizesAndReturnsMetadata()
    {
        // Arrange — a 200x150 source; processing should downscale to fit 100x100 => 100x75.
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var content = BuildImageUpload(MakePng(200, 150));

        // Act
        var response = await client.PostAsync(
            $"/api/v1/trails/{StorsjoledenIdentifier}/images", content, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var images = await response.Content.ReadFromJsonAsync<List<TrailImageResponse>>(
            TestContext.Current.CancellationToken);
        images.Should().NotBeNull();
        images!.Should().HaveCount(1);
        images[0].Width.Should().Be(100);
        images[0].Height.Should().Be(75);
        images[0].SizeBytes.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task GetAllMedia_WhenAuthenticated_ReturnsUploadedImage()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var upload = await client.PostAsync(
            $"/api/v1/trails/{StorsjoledenIdentifier}/images", BuildImageUpload(MakePng(300, 300)),
            TestContext.Current.CancellationToken);
        upload.StatusCode.Should().Be(HttpStatusCode.OK);

        // Act
        var response = await client.GetAsync("/api/v1/media", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var media = await response.Content.ReadFromJsonAsync<List<MediaItemResponse>>(
            TestContext.Current.CancellationToken);
        media.Should().NotBeNull();
        media!.Should().Contain(m => m.OwnerType == "Trail");
    }

    [Fact]
    public async Task GetAllMedia_WhenUnauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/v1/media", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
