// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using ImageMagick;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.Media;
using WebDataContracts.ResponseModels.Media;
using WebDataContracts.ResponseModels.Trail;

namespace IntegrationTests.Admin;

public class AdminMediaControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string AuthenticatedUser = "firebase-uid-12346"; // User 2: VandrarVennen
    private const string AdminRole = "stigvidd-admin";
    private const string StorsjoledenIdentifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // Trail 2

    public AdminMediaControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
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

    private static MultipartFormDataContent BuildUnprocessedUpload(byte[] imageBytes)
    {
        var imageContent = new ByteArrayContent(imageBytes);
        imageContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");

        return new MultipartFormDataContent
        {
            { imageContent, "images", "photo.png" },
            { new StringContent("png"), "Format" },
        };
    }

    [Fact]
    public async Task AddTrailImages_WithRealImageAndOptions_ResizesAndReturnsMetadata()
    {
        // Arrange — a 200x150 source; processing should downscale to fit 100x100 => 100x75.
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, TestAuthHandler.AdminRole);

        var content = BuildImageUpload(MakePng(200, 150));

        // Act
        var response = await client.PostAsync(
            $"/api/v1/admin/trails/{StorsjoledenIdentifier}/images", content, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var images = await response.Content.ReadFromJsonAsync<List<TrailImageResponse>>(
            TestContext.Current.CancellationToken);
        images.Should().NotBeNull();
        images.Should().HaveCount(1);
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
        client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, TestAuthHandler.AdminRole);

        var upload = await client.PostAsync(
            $"/api/v1/admin/trails/{StorsjoledenIdentifier}/images", BuildImageUpload(MakePng(300, 300)),
            TestContext.Current.CancellationToken);
        upload.StatusCode.Should().Be(HttpStatusCode.OK);

        // Act
        var response = await client.GetAsync("/api/v1/admin/media", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var media = await response.Content.ReadFromJsonAsync<MediaLibraryPageResponse>(
            TestContext.Current.CancellationToken);
        media.Should().NotBeNull();
        media.Items.Should().Contain(m => m.OwnerType == "Trail");
    }

    [Fact]
    public async Task UpdateMetadata_WithAdminRole_ShouldPersistAltTextAndCaption()
    {
        // Arrange — upload so there is a media item to annotate.
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, TestAuthHandler.AdminRole);

        var upload = await client.PostAsync(
            $"/api/v1/admin/trails/{StorsjoledenIdentifier}/images", BuildImageUpload(MakePng(200, 200)),
            TestContext.Current.CancellationToken);
        upload.StatusCode.Should().Be(HttpStatusCode.OK);

        var uploaded = await upload.Content.ReadFromJsonAsync<List<TrailImageResponse>>(
            TestContext.Current.CancellationToken);
        uploaded.Should().NotBeNull();
        var imageIdentifier = uploaded.Single().Identifier;

        var request = new UpdateImageMetadataRequest
        {
            AltText = "Utsikt över Storsjön",
            Caption = "Leden vid vattnet",
        };

        // Act
        var response = await client.PatchAsJsonAsync(
            $"/api/v1/admin/media/{imageIdentifier}", request, TestContext.Current.CancellationToken);

        // Assert — re-read through the library rather than trusting the write's own response.
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var media = await client.GetFromJsonAsync<MediaLibraryPageResponse>(
            "/api/v1/admin/media", TestContext.Current.CancellationToken);
        media.Should().NotBeNull();
        var item = media.Items.Single(m => m.Identifier == imageIdentifier);
        item.AltText.Should().Be("Utsikt över Storsjön");
        item.Caption.Should().Be("Leden vid vattnet");
    }

    [Fact]
    public async Task UpdateMetadata_WithNonExistentImage_ShouldReturnNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, TestAuthHandler.AdminRole);

        // Act
        var response = await client.PatchAsJsonAsync(
            "/api/v1/admin/media/00000000-0000-0000-0000-000000000000",
            new UpdateImageMetadataRequest { AltText = "x" }, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetAllMedia_WhenUnauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/v1/admin/media", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetAllMedia_WithoutAdminRole_ReturnsForbidden()
    {
        // Arrange — signed in as an ordinary app user, no realm role.
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.GetAsync("/api/v1/admin/media", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // keep-comment: MediaReprocessDispatcher is removed for this factory, so these prove the HTTP surface and journal only, not that a job ever completes.
    private async Task<HttpClient> AdminClientAsync()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, TestAuthHandler.AdminRole);
        return client;
    }

    private async Task<string> UploadATrailImageAsync(HttpClient client)
    {
        var upload = await client.PostAsync(
            $"/api/v1/admin/trails/{StorsjoledenIdentifier}/images", BuildImageUpload(MakePng(200, 200)),
            TestContext.Current.CancellationToken);
        upload.StatusCode.Should().Be(HttpStatusCode.OK);

        var uploaded = await upload.Content.ReadFromJsonAsync<List<TrailImageResponse>>(TestContext.Current.CancellationToken);
        uploaded.Should().NotBeNull();
        return uploaded.Single().Identifier;
    }

    [Fact]
    public async Task CreateReprocessJob_WithAnUploadedTrailImage_ReturnsCreatedWithAPendingJob()
    {
        // Arrange
        var client = await AdminClientAsync();
        var imageIdentifier = await UploadATrailImageAsync(client);

        var request = new CreateMediaReprocessJobRequest
        {
            MediaIdentifiers = [imageIdentifier],
            Options = new ImageProcessingOptionsRequest { MaxWidth = 100 },
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/admin/media/reprocess", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var job = await response.Content.ReadFromJsonAsync<MediaReprocessJobSummaryResponse>(TestContext.Current.CancellationToken);
        job.Should().NotBeNull();
        job.Status.Should().Be("Pending");
        job.TotalCount.Should().Be(1);
        job.PendingCount.Should().Be(1);
    }

    [Fact]
    public async Task CreateReprocessJob_WithAnUnknownIdentifier_ReturnsBadRequest()
    {
        // Arrange
        var client = await AdminClientAsync();
        var request = new CreateMediaReprocessJobRequest
        {
            MediaIdentifiers = ["00000000-0000-0000-0000-000000000000"],
            Options = new ImageProcessingOptionsRequest { MaxWidth = 100 },
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/admin/media/reprocess", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateReprocessJob_WithoutAdminRole_ReturnsForbidden()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        var request = new CreateMediaReprocessJobRequest
        {
            MediaIdentifiers = ["00000000-0000-0000-0000-000000000000"],
            Options = new ImageProcessingOptionsRequest(),
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/admin/media/reprocess", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetReprocessJobs_AfterCreatingAJob_ListsIt()
    {
        // Arrange
        var client = await AdminClientAsync();
        var imageIdentifier = await UploadATrailImageAsync(client);
        var created = await client.PostAsJsonAsync(
            "/api/v1/admin/media/reprocess",
            new CreateMediaReprocessJobRequest { MediaIdentifiers = [imageIdentifier], Options = new ImageProcessingOptionsRequest() },
            TestContext.Current.CancellationToken);
        var job = await created.Content.ReadFromJsonAsync<MediaReprocessJobSummaryResponse>(TestContext.Current.CancellationToken);
        job.Should().NotBeNull();

        // Act
        var response = await client.GetAsync("/api/v1/admin/media/reprocess?page=1&pageSize=20", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var page = await response.Content.ReadFromJsonAsync<PagedResult<MediaReprocessJobSummaryResponse>>(TestContext.Current.CancellationToken);
        page.Should().NotBeNull();
        page.Items.Should().Contain(j => j.Identifier == job.Identifier);
    }

    [Fact]
    public async Task GetReprocessJob_ForAnUnknownIdentifier_ReturnsNotFound()
    {
        // Arrange
        var client = await AdminClientAsync();

        // Act
        var response = await client.GetAsync("/api/v1/admin/media/reprocess/no-such-job", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetReprocessJob_AfterCreatingAJob_ReturnsItsPendingItem()
    {
        // Arrange
        var client = await AdminClientAsync();
        var imageIdentifier = await UploadATrailImageAsync(client);
        var created = await client.PostAsJsonAsync(
            "/api/v1/admin/media/reprocess",
            new CreateMediaReprocessJobRequest { MediaIdentifiers = [imageIdentifier], Options = new ImageProcessingOptionsRequest() },
            TestContext.Current.CancellationToken);
        var job = await created.Content.ReadFromJsonAsync<MediaReprocessJobSummaryResponse>(TestContext.Current.CancellationToken);
        job.Should().NotBeNull();

        // Act
        var response = await client.GetAsync($"/api/v1/admin/media/reprocess/{job.Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var detail = await response.Content.ReadFromJsonAsync<MediaReprocessJobDetailResponse>(TestContext.Current.CancellationToken);
        detail.Should().NotBeNull();
        detail.Items.Should().ContainSingle(i => i.MediaIdentifier == imageIdentifier && i.Status == "Pending");
    }

    [Fact]
    public async Task CancelReprocessJob_ForAPendingJob_CancelsItsItems()
    {
        // Arrange
        var client = await AdminClientAsync();
        var imageIdentifier = await UploadATrailImageAsync(client);
        var created = await client.PostAsJsonAsync(
            "/api/v1/admin/media/reprocess",
            new CreateMediaReprocessJobRequest { MediaIdentifiers = [imageIdentifier], Options = new ImageProcessingOptionsRequest() },
            TestContext.Current.CancellationToken);
        var job = await created.Content.ReadFromJsonAsync<MediaReprocessJobSummaryResponse>(TestContext.Current.CancellationToken);
        job.Should().NotBeNull();

        // Act
        var response = await client.PostAsync($"/api/v1/admin/media/reprocess/{job.Identifier}/cancel", null, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var cancelled = await response.Content.ReadFromJsonAsync<MediaReprocessJobSummaryResponse>(TestContext.Current.CancellationToken);
        cancelled.Should().NotBeNull();
        cancelled.CancelledCount.Should().Be(1);
        cancelled.PendingCount.Should().Be(0);
        cancelled.Status.Should().Be("Completed");
    }

    [Fact]
    public async Task CancelReprocessJob_ForAnUnknownIdentifier_ReturnsNotFound()
    {
        // Arrange
        var client = await AdminClientAsync();

        // Act
        var response = await client.PostAsync("/api/v1/admin/media/reprocess/no-such-job/cancel", null, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetAllMedia_WithAFormatFilter_ReturnsOnlyThatFormat()
    {
        // Arrange
        var client = await AdminClientAsync();

        // Act
        var unfiltered = await client.GetFromJsonAsync<MediaLibraryPageResponse>(
            "/api/v1/admin/media?pageSize=200", TestContext.Current.CancellationToken);
        var response = await client.GetAsync("/api/v1/admin/media?format=png&pageSize=200", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        unfiltered.Should().NotBeNull();
        unfiltered.Items.Should().Contain(m => m.Format == "png" && m.OwnerType == "TrailSymbol");

        var media = await response.Content.ReadFromJsonAsync<MediaLibraryPageResponse>(TestContext.Current.CancellationToken);
        media.Should().NotBeNull();
        media.Items.Should().OnlyContain(m => m.Format == "png");
        media.Items.Should().NotContain(m => m.OwnerType == "TrailSymbol");
    }

    [Fact]
    public async Task GetAllMedia_WithAFormatFilter_MapsJpgToJpeg()
    {
        // Arrange
        var client = await AdminClientAsync();

        // Act
        var response = await client.GetAsync("/api/v1/admin/media?format=jpeg&pageSize=200", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var media = await response.Content.ReadFromJsonAsync<MediaLibraryPageResponse>(TestContext.Current.CancellationToken);
        media.Should().NotBeNull();
        media.Items.Should().NotBeEmpty();
        media.Items.Should().OnlyContain(m => m.Format == "jpeg");
    }

    [Fact]
    public async Task GetAllMedia_WithPaging_ReturnsAtMostPageSizeAndATotal()
    {
        // Arrange
        var client = await AdminClientAsync();

        // Act
        var response = await client.GetAsync("/api/v1/admin/media?page=1&pageSize=2", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var media = await response.Content.ReadFromJsonAsync<MediaLibraryPageResponse>(TestContext.Current.CancellationToken);
        media.Should().NotBeNull();
        media.Items.Count.Should().BeLessThanOrEqualTo(2);
        media.TotalCount.Should().BeGreaterThan(2);
        media.HasMore.Should().BeTrue();
        media.ReprocessableCount.Should().BeLessThanOrEqualTo(media.TotalCount);
    }

    [Fact]
    public async Task GetAllMedia_WithATargetFilter_ExcludesWhatIsAlreadyWithinIt()
    {
        // Arrange
        var client = await AdminClientAsync();
        var compact = await client.PostAsync(
            $"/api/v1/admin/trails/{StorsjoledenIdentifier}/images", BuildImageUpload(MakePng(120, 120)),
            TestContext.Current.CancellationToken);
        var compactImages = await compact.Content.ReadFromJsonAsync<List<TrailImageResponse>>(TestContext.Current.CancellationToken);
        compactImages.Should().NotBeNull();
        var compactIdentifier = compactImages.Single().Identifier;

        // Act
        var response = await client.GetAsync(
            "/api/v1/admin/media?targetMaxWidth=800&pageSize=200", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var media = await response.Content.ReadFromJsonAsync<MediaLibraryPageResponse>(TestContext.Current.CancellationToken);
        media.Should().NotBeNull();
        media.Items.Should().NotContain(m => m.Identifier == compactIdentifier);
        media.Items.Should().NotContain(m => m.OwnerType == "TrailSymbol");
    }

    [Fact]
    public async Task GetAllMedia_WithAnUnknownFormat_ReturnsBadRequest()
    {
        // Arrange
        var client = await AdminClientAsync();

        // Act
        var response = await client.GetAsync("/api/v1/admin/media?format=wepb", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateReprocessJob_FromAFilter_CreatesAJobForTheMatchingImages()
    {
        // Arrange
        var client = await AdminClientAsync();
        await client.PostAsync(
            $"/api/v1/admin/trails/{StorsjoledenIdentifier}/images", BuildUnprocessedUpload(MakePng(1400, 1100)),
            TestContext.Current.CancellationToken);

        var listed = await client.GetFromJsonAsync<MediaLibraryPageResponse>(
            "/api/v1/admin/media?targetMaxWidth=800&targetFormat=webp&pageSize=200", TestContext.Current.CancellationToken);
        listed.Should().NotBeNull();
        listed.ReprocessableCount.Should().BeGreaterThan(0);

        var request = new CreateMediaReprocessJobRequest
        {
            Filter = new MediaFilter { TargetMaxWidth = 800, TargetFormat = "webp" },
            Options = new ImageProcessingOptionsRequest { MaxWidth = 800, MaxHeight = 800, Quality = 50, Format = "webp" },
        };

        // Act
        var response = await client.PostAsJsonAsync(
            "/api/v1/admin/media/reprocess", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var job = await response.Content.ReadFromJsonAsync<MediaReprocessJobSummaryResponse>(TestContext.Current.CancellationToken);
        job.Should().NotBeNull();
        job.TotalCount.Should().Be(listed.ReprocessableCount);
    }

    [Fact]
    public async Task CreateReprocessJob_WithNeitherIdentifiersNorFilter_ReturnsBadRequest()
    {
        // Arrange
        var client = await AdminClientAsync();
        var request = new CreateMediaReprocessJobRequest
        {
            Options = new ImageProcessingOptionsRequest { MaxWidth = 800 },
        };

        // Act
        var response = await client.PostAsJsonAsync(
            "/api/v1/admin/media/reprocess", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateReprocessJob_WithAMisspelledOutputFormat_ReturnsBadRequest()
    {
        // Arrange
        var client = await AdminClientAsync();
        var identifier = await UploadATrailImageAsync(client);

        var request = new CreateMediaReprocessJobRequest
        {
            MediaIdentifiers = [identifier],
            Options = new ImageProcessingOptionsRequest { MaxWidth = 800, Format = "wepb" },
        };

        // Act
        var response = await client.PostAsJsonAsync(
            "/api/v1/admin/media/reprocess", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetAllMedia_WithALowerCaseOwnerType_ReturnsThatOwnersImagesNotAnEmptyLibrary()
    {
        // Arrange
        var client = await AdminClientAsync();

        // Act
        var canonical = await client.GetFromJsonAsync<MediaLibraryPageResponse>(
            "/api/v1/admin/media?ownerType=Trail&pageSize=200", TestContext.Current.CancellationToken);
        var response = await client.GetAsync(
            "/api/v1/admin/media?ownerType=trail&pageSize=200", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        canonical.Should().NotBeNull();
        canonical.TotalCount.Should().BeGreaterThan(0);

        var media = await response.Content.ReadFromJsonAsync<MediaLibraryPageResponse>(
            TestContext.Current.CancellationToken);
        media.Should().NotBeNull();
        media.TotalCount.Should().Be(canonical.TotalCount);
        media.Items.Should().OnlyContain(m => m.OwnerType == "Trail");
    }

    [Fact]
    public async Task GetAllMedia_WithAnUnknownOwnerType_ReturnsBadRequest()
    {
        // Arrange
        var client = await AdminClientAsync();

        // Act
        var response = await client.GetAsync(
            "/api/v1/admin/media?ownerType=Trials", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetAllMedia_WithAPageBeyondTheCap_ReturnsBadRequestRatherThanTheFirstPage()
    {
        // Arrange
        var client = await AdminClientAsync();

        // Act
        var response = await client.GetAsync(
            "/api/v1/admin/media?page=20000000&pageSize=200", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetAllMedia_OnAPageBeyondTheLastOne_ReturnsNoItemsAndDoesNotOfferMore()
    {
        // Arrange
        var client = await AdminClientAsync();

        // Act
        var response = await client.GetAsync(
            "/api/v1/admin/media?page=5000&pageSize=200", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var media = await response.Content.ReadFromJsonAsync<MediaLibraryPageResponse>(
            TestContext.Current.CancellationToken);
        media.Should().NotBeNull();
        media.Items.Should().BeEmpty();
        media.HasMore.Should().BeFalse();
    }

    // keep-comment: one case per filter, because EF folds "@p IS NULL OR ..." away when a parameter is known null and caches the command by parameter nullability - a green unfiltered request proves nothing about a filtered one, and a translation failure surfaces as a 500 with an empty body plus a log line no assertion here would print
    [Theory]
    [InlineData("sort=newest")]
    [InlineData("sort=oldest")]
    [InlineData("sort=largest")]
    [InlineData("sort=widest")]
    [InlineData("ownerType=Facility")]
    [InlineData("ownerType=TrailSymbol")]
    [InlineData("minWidth=1")]
    [InlineData("maxWidth=100000")]
    [InlineData("minHeight=1&maxHeight=100000")]
    [InlineData("minSizeBytes=0&maxSizeBytes=100000000")]
    [InlineData("createdFrom=2000-01-01")]
    [InlineData("createdTo=2999-01-01")]
    [InlineData("createdFrom=2000-01-01&createdTo=2999-01-01")]
    [InlineData("createdFrom=2000-01-01T00:00:00Z&createdTo=2999-01-01T00:00:00Z")]
    [InlineData("format=png&sort=largest&minWidth=1")]
    public async Task GetAllMedia_WithEachFilter_TranslatesRatherThanFailing(string queryString)
    {
        // Arrange
        var client = await AdminClientAsync();

        // Act
        var response = await client.GetAsync(
            $"/api/v1/admin/media?pageSize=200&{queryString}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var media = await response.Content.ReadFromJsonAsync<MediaLibraryPageResponse>(
            TestContext.Current.CancellationToken);
        media.Should().NotBeNull();
    }

    [Fact]
    public async Task GetAllMedia_WithAnOwnerIdentifier_ReturnsOnlyThatOwnersImages()
    {
        // Arrange
        var client = await AdminClientAsync();

        // Act
        var response = await client.GetAsync(
            $"/api/v1/admin/media?ownerIdentifier={StorsjoledenIdentifier}&pageSize=200",
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var media = await response.Content.ReadFromJsonAsync<MediaLibraryPageResponse>(
            TestContext.Current.CancellationToken);
        media.Should().NotBeNull();
        media.Items.Should().NotBeEmpty();
        media.Items.Should().OnlyContain(m => m.OwnerIdentifier == StorsjoledenIdentifier);
    }

    [Fact]
    public async Task GetAllMedia_WithACreatedRangeThatExcludesEverything_ReturnsNothing()
    {
        // Arrange
        var client = await AdminClientAsync();

        // Act
        var response = await client.GetAsync(
            "/api/v1/admin/media?createdFrom=1990-01-01&createdTo=1991-01-01&pageSize=200",
            TestContext.Current.CancellationToken);

        // Assert
        // keep-comment: asserts the bound is APPLIED, not merely that the query ran - a date filter that silently matched everything would still pass the translation theory above
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var media = await response.Content.ReadFromJsonAsync<MediaLibraryPageResponse>(
            TestContext.Current.CancellationToken);
        media.Should().NotBeNull();
        media.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task GetAllMedia_SortedOldestFirst_ReversesTheDefaultOrder()
    {
        // Arrange
        var client = await AdminClientAsync();

        // Act
        var newest = await client.GetFromJsonAsync<MediaLibraryPageResponse>(
            "/api/v1/admin/media?sort=newest&pageSize=200", TestContext.Current.CancellationToken);
        var oldest = await client.GetFromJsonAsync<MediaLibraryPageResponse>(
            "/api/v1/admin/media?sort=oldest&pageSize=200", TestContext.Current.CancellationToken);

        // Assert
        newest.Should().NotBeNull();
        oldest.Should().NotBeNull();
        newest.Items.Should().NotBeEmpty();
        oldest.Items.Select(m => m.Identifier)
            .Should().BeEquivalentTo(newest.Items.Select(m => m.Identifier));
        oldest.Items.Select(m => m.CreatedAt).Should().BeInAscendingOrder();
        newest.Items.Select(m => m.CreatedAt).Should().BeInDescendingOrder();
    }

    [Fact]
    public async Task GetAllMedia_SortedLargestFirst_OrdersBySizeDescending()
    {
        // Arrange
        var client = await AdminClientAsync();
        await client.PostAsync(
            $"/api/v1/admin/trails/{StorsjoledenIdentifier}/images", BuildUnprocessedUpload(MakePng(1400, 1100)),
            TestContext.Current.CancellationToken);

        // Act
        var largest = await client.GetFromJsonAsync<MediaLibraryPageResponse>(
            "/api/v1/admin/media?sort=largest&pageSize=200", TestContext.Current.CancellationToken);

        // Assert
        largest.Should().NotBeNull();
        largest.Items.Should().NotBeEmpty();
        largest.Items.Select(m => m.SizeBytes).Should().BeInDescendingOrder();
    }

    [Fact]
    public async Task GetAllMedia_PagedThrough_VisitsEveryImageExactlyOnce()
    {
        // Arrange
        var client = await AdminClientAsync();
        var whole = await client.GetFromJsonAsync<MediaLibraryPageResponse>(
            "/api/v1/admin/media?pageSize=200", TestContext.Current.CancellationToken);
        whole.Should().NotBeNull();

        // Act
        var walked = new List<string>();
        for (var page = 1; page <= 20; page++)
        {
            var slice = await client.GetFromJsonAsync<MediaLibraryPageResponse>(
                $"/api/v1/admin/media?page={page}&pageSize=2", TestContext.Current.CancellationToken);
            slice.Should().NotBeNull();
            walked.AddRange(slice.Items.Select(m => m.Identifier));

            if (!slice.HasMore)
                break;
        }

        // Assert
        // keep-comment: a page boundary that drops or repeats a row shows up here and in no other test - every single-page assertion is blind to it
        walked.Should().OnlyHaveUniqueItems();
        walked.Should().BeEquivalentTo(whole.Items.Select(m => m.Identifier));
    }

    [Fact]
    public async Task CreateReprocessJob_WithAFilterNamingAnUnknownFormat_SaysSoRatherThanMatchingNothing()
    {
        // Arrange
        var client = await AdminClientAsync();
        var request = new CreateMediaReprocessJobRequest
        {
            Filter = new MediaFilter { Format = "wepb" },
            Options = new ImageProcessingOptionsRequest { MaxWidth = 800 },
        };

        // Act
        var response = await client.PostAsJsonAsync(
            "/api/v1/admin/media/reprocess", request, TestContext.Current.CancellationToken);

        // Assert
        // keep-comment: the same value on GET is a format error, so it has to be one here too - "No images match that filter" for a typo is exactly what sharing one validator exists to prevent
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("Format");
    }

    [Fact]
    public async Task CreateReprocessJob_WithAFilterNamingAnUnknownOwnerType_SaysSoRatherThanMatchingNothing()
    {
        // Arrange
        var client = await AdminClientAsync();
        var request = new CreateMediaReprocessJobRequest
        {
            Filter = new MediaFilter { OwnerType = "Trials" },
            Options = new ImageProcessingOptionsRequest { MaxWidth = 800 },
        };

        // Act
        var response = await client.PostAsJsonAsync(
            "/api/v1/admin/media/reprocess", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("OwnerType");
    }
}
