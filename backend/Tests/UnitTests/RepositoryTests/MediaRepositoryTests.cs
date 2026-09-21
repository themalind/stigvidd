// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Repositories;
using AwesomeAssertions;
using Infrastructure.Data;
using WebDataContracts.RequestModels.Media;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class MediaRepositoryTests : TestBase
{
    // Seeded trail image (Tiveden, trail 1) and a facility image added on top of the standard seed,
    // so the repository's three-way media projection (trail / facility / symbol) can be verified.
    private const string SeededTrailImageIdentifier = "img-tiveden-1";
    private const string SeededFacilityImageIdentifier = "fac-media-img";

    private static void SeedFacilityImage(StigViddDbContext db)
    {
        db.FacilityImages.Add(new FacilityImage
        {
            Identifier = SeededFacilityImageIdentifier,
            ImageUrl = "facilities/pic.jpg",
            FacilityId = 1, // Grillplats Tiveden
            Width = 100,
            Height = 100,
            SizeBytes = 999,
            CreatedAt = Utilities.SeedDates.Created,
            LastUpdatedAt = Utilities.SeedDates.Updated
        });
    }

    private sealed record FakeImage(
        string Identifier,
        string ImageUrl,
        int Width,
        int Height,
        long SizeBytes,
        DateTime CreatedAt) : IMediaImage;

    private static FakeImage Item(
        string identifier,
        string imageUrl = "trails/pic.jpeg",
        int width = 1000,
        int height = 800,
        long sizeBytes = 5000,
        DateTime? createdAt = null) =>
        new(identifier, imageUrl, width, height, sizeBytes,
            createdAt ?? new DateTime(2026, 3, 12, 0, 0, 0, DateTimeKind.Utc));

    private static IReadOnlyCollection<FakeImage> Matching(
        MediaFilter filter, params FakeImage[] items) =>
        items.AsQueryable().Where(MediaRepository.Matches<FakeImage>(filter)).ToList();

    [Fact]
    public async Task GetMediaPagedAsync_ReturnsTrailFacilityAndSymbolMedia()
    {
        // Arrange
        var repo = new MediaRepository(CreateSeededFactory(SeedFacilityImage), NullLogger<MediaRepository>.Instance);

        // Act
        var result = await repo.GetMediaPagedAsync(new MediaLibraryQuery { PageSize = 200 }, TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().NotBeNull();
        result.IsSuccess.Should().BeTrue();
        result.Value.Items.Should().Contain(m => m.Identifier == SeededTrailImageIdentifier && m.OwnerType == "Trail");
        result.Value.Items.Should().Contain(m => m.Identifier == SeededFacilityImageIdentifier && m.OwnerType == "Facility");
        result.Value.Items.Should().Contain(m => m.OwnerType == "TrailSymbol");
    }

    [Fact]
    public async Task GetMediaPagedAsync_ProjectsOwnerNameFromRelatedEntity()
    {
        // Arrange
        var repo = new MediaRepository(CreateSeededFactory(SeedFacilityImage), NullLogger<MediaRepository>.Instance);

        // Act
        var result = await repo.GetMediaPagedAsync(new MediaLibraryQuery { PageSize = 200 }, TestContext.Current.CancellationToken);
        result.Value.Should().NotBeNull();

        // Assert — the trail/facility owner name is projected through the navigation.
        result.Value.Items.Should().Contain(m => m.Identifier == SeededTrailImageIdentifier && m.OwnerName == "Tiveden");
        result.Value.Items.Should().Contain(m => m.Identifier == SeededFacilityImageIdentifier && m.OwnerName == "Grillplats Tiveden");
    }

    [Fact]
    public void Matches_WithNoFilter_KeepsEverything()
    {
        // Arrange
        var small = Item("a", width: 10, height: 10);
        var large = Item("b", width: 4000, height: 3000);

        // Act
        var kept = Matching(new MediaFilter(), small, large);

        // Assert
        kept.Should().HaveCount(2);
    }

    [Fact]
    public void Matches_WithFormat_ComparesTheExtensionCaseInsensitively()
    {
        // Arrange
        var webp = Item("a", imageUrl: "trails/PIC.WEBP");
        var jpeg = Item("b", imageUrl: "trails/pic.jpeg");

        // Act
        var kept = Matching(new MediaFilter { Format = "WebP" }, webp, jpeg);

        // Assert
        kept.Should().ContainSingle().Which.Identifier.Should().Be("a");
    }

    [Fact]
    public void Matches_WithFormatJpg_IsTheSameAsJpeg()
    {
        // Arrange
        var jpeg = Item("a", imageUrl: "trails/pic.jpeg");

        // Act
        var kept = Matching(new MediaFilter { Format = "jpg" }, jpeg);

        // Assert
        kept.Should().ContainSingle();
    }

    [Fact]
    public void Matches_WithDimensionBounds_KeepsOnlyWhatIsInside()
    {
        // Arrange
        var narrow = Item("a", width: 100);
        var wide = Item("b", width: 5000);

        // Act
        var kept = Matching(new MediaFilter { MinWidth = 200, MaxWidth = 6000 }, narrow, wide);

        // Assert
        kept.Should().ContainSingle().Which.Identifier.Should().Be("b");
    }

    [Fact]
    public void Matches_WithSizeBounds_KeepsOnlyWhatIsInside()
    {
        // Arrange
        var tiny = Item("a", sizeBytes: 100);
        var heavy = Item("b", sizeBytes: 900_000);

        // Act
        var kept = Matching(new MediaFilter { MinSizeBytes = 1000 }, tiny, heavy);

        // Assert
        kept.Should().ContainSingle().Which.Identifier.Should().Be("b");
    }

    [Fact]
    public void Matches_WithCreatedTo_TreatsTheUpperBoundAsExclusive()
    {
        // Arrange
        var onTheDay = Item("a", createdAt: new DateTime(2026, 3, 12, 9, 0, 0, DateTimeKind.Utc));
        var theNextDay = Item("b", createdAt: new DateTime(2026, 3, 13, 0, 0, 0, DateTimeKind.Utc));

        // Act
        var kept = Matching(
            new MediaFilter { CreatedTo = new DateTime(2026, 3, 13, 0, 0, 0, DateTimeKind.Utc) },
            onTheDay, theNextDay);

        // Assert
        kept.Should().ContainSingle().Which.Identifier.Should().Be("a");
    }

    [Fact]
    public void Matches_NormalisesAnUnspecifiedKindBoundToUtc()
    {
        // Arrange
        var filter = new MediaFilter { CreatedFrom = new DateTime(2026, 3, 12, 0, 0, 0, DateTimeKind.Unspecified) };
        var item = Item("a", createdAt: new DateTime(2026, 3, 12, 9, 0, 0, DateTimeKind.Utc));

        // Act
        var kept = Matching(filter, item);
        var normalised = MediaRepository.ToUtc(filter.CreatedFrom);

        // Assert
        kept.Should().ContainSingle();
        normalised.Should().NotBeNull();
        normalised.Value.Kind.Should().Be(DateTimeKind.Utc);
        normalised.Value.Should().Be(new DateTime(2026, 3, 12, 0, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void Matches_WithATargetWidth_KeepsOnlyImagesLargerThanIt()
    {
        // Arrange
        var compact = Item("a", width: 800, height: 600, imageUrl: "trails/pic.webp");
        var oversize = Item("b", width: 3000, height: 2000, imageUrl: "trails/pic.webp");

        // Act
        var kept = Matching(new MediaFilter { TargetMaxWidth = 800, TargetFormat = "webp" }, compact, oversize);

        // Assert
        kept.Should().ContainSingle().Which.Identifier.Should().Be("b");
    }

    [Fact]
    public void Matches_WithATargetFormat_KeepsAnotherFormatEvenWhenSmall()
    {
        // Arrange
        var smallJpeg = Item("a", width: 100, height: 100, imageUrl: "trails/pic.jpeg");

        // Act
        var kept = Matching(new MediaFilter { TargetMaxWidth = 800, TargetFormat = "webp" }, smallJpeg);

        // Assert
        kept.Should().ContainSingle();
    }

    [Fact]
    public void Matches_WithATargetWidth_KeepsRowsWhoseDimensionsAreUnknown()
    {
        // Arrange
        var unmeasured = Item("a", width: 0, height: 0, imageUrl: "trails/pic.webp");

        // Act
        var kept = Matching(new MediaFilter { TargetMaxWidth = 800, TargetFormat = "webp" }, unmeasured);

        // Assert
        kept.Should().ContainSingle();
    }

    [Fact]
    public void HasMetadataFilter_IsTrueOnlyForFiltersATrailSymbolCannotAnswer()
    {
        // Assert
        MediaRepository.HasMetadataFilter(new MediaFilter()).Should().BeFalse();
        MediaRepository.HasMetadataFilter(new MediaFilter { OwnerType = "Trail" }).Should().BeFalse();
        MediaRepository.HasMetadataFilter(new MediaFilter { CreatedFrom = DateTime.UtcNow }).Should().BeFalse();

        MediaRepository.HasMetadataFilter(new MediaFilter { Format = "webp" }).Should().BeTrue();
        MediaRepository.HasMetadataFilter(new MediaFilter { MinWidth = 1 }).Should().BeTrue();
        MediaRepository.HasMetadataFilter(new MediaFilter { MaxSizeBytes = 1 }).Should().BeTrue();
        MediaRepository.HasMetadataFilter(new MediaFilter { TargetMaxWidth = 800 }).Should().BeTrue();
    }

    [Fact]
    public async Task GetMediaPagedAsync_WithAMetadataFilter_ExcludesTrailSymbols()
    {
        // Arrange
        var repo = new MediaRepository(CreateSeededFactory(SeedFacilityImage), NullLogger<MediaRepository>.Instance);

        // Act
        var result = await repo.GetMediaPagedAsync(
            new MediaLibraryQuery { MinWidth = 0, PageSize = 200 }, TestContext.Current.CancellationToken);
        result.Value.Should().NotBeNull();

        // Assert
        result.Value.Items.Should().NotContain(m => m.OwnerType == "TrailSymbol");
    }

    [Fact]
    public async Task GetMediaPagedAsync_ReprocessableCountNeverCountsTrailSymbols()
    {
        // Arrange
        var repo = new MediaRepository(CreateSeededFactory(SeedFacilityImage), NullLogger<MediaRepository>.Instance);

        // Act
        var result = await repo.GetMediaPagedAsync(
            new MediaLibraryQuery { PageSize = 200 }, TestContext.Current.CancellationToken);
        result.Value.Should().NotBeNull();

        // Assert
        var symbols = result.Value.Items.Count(m => m.OwnerType == "TrailSymbol");
        symbols.Should().BeGreaterThan(0);
        result.Value.ReprocessableCount.Should().Be(result.Value.TotalCount - symbols);
    }

    [Fact]
    public async Task GetMediaPagedAsync_PagesAndReportsHasMore()
    {
        // Arrange
        var repo = new MediaRepository(CreateSeededFactory(SeedFacilityImage), NullLogger<MediaRepository>.Instance);

        // Act
        var first = await repo.GetMediaPagedAsync(
            new MediaLibraryQuery { Page = 1, PageSize = 1 }, TestContext.Current.CancellationToken);
        var second = await repo.GetMediaPagedAsync(
            new MediaLibraryQuery { Page = 2, PageSize = 1 }, TestContext.Current.CancellationToken);
        first.Value.Should().NotBeNull();
        second.Value.Should().NotBeNull();

        // Assert
        first.Value.Items.Should().ContainSingle();
        first.Value.HasMore.Should().BeTrue();
        second.Value.Items.Should().ContainSingle();
        second.Value.Items.First().Identifier.Should().NotBe(first.Value.Items.First().Identifier);
    }

    [Fact]
    public async Task GetMatchingAsync_NeverReturnsATrailSymbol()
    {
        // Arrange
        var repo = new MediaRepository(CreateSeededFactory(SeedFacilityImage), NullLogger<MediaRepository>.Instance);

        // Act
        var result = await repo.GetMatchingAsync(new MediaFilter(), 1000, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeEmpty();
        result.Value.Should().OnlyContain(m => m.OwnerType == "Trail" || m.OwnerType == "Facility");
    }

    [Fact]
    public async Task GetMatchingAsync_StopsAtTheLimit()
    {
        // Arrange
        var repo = new MediaRepository(CreateSeededFactory(SeedFacilityImage), NullLogger<MediaRepository>.Instance);

        // Act
        var result = await repo.GetMatchingAsync(new MediaFilter(), 1, TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().ContainSingle();
    }

    [Fact]
    public async Task UpdateImageMetadataAsync_WhenTrailImage_UpdatesAltAndCaption()
    {
        // Arrange
        var factory = CreateSeededFactory(SeedFacilityImage);
        var repo = new MediaRepository(factory, NullLogger<MediaRepository>.Instance);

        // Act
        var update = await repo.UpdateImageMetadataAsync(SeededTrailImageIdentifier, "updated alt", "updated caption", TestContext.Current.CancellationToken);

        // Assert
        update.IsSuccess.Should().BeTrue();

        var all = await repo.GetMediaPagedAsync(new MediaLibraryQuery { PageSize = 200 }, TestContext.Current.CancellationToken);
        all.Value.Should().NotBeNull();
        all.Value.Items.Should().Contain(m =>
            m.Identifier == SeededTrailImageIdentifier && m.AltText == "updated alt" && m.Caption == "updated caption");
    }

    [Fact]
    public async Task UpdateImageMetadataAsync_WhenFacilityImage_UpdatesAltAndCaption()
    {
        // Arrange
        var factory = CreateSeededFactory(SeedFacilityImage);
        var repo = new MediaRepository(factory, NullLogger<MediaRepository>.Instance);

        // Act
        var update = await repo.UpdateImageMetadataAsync(SeededFacilityImageIdentifier, "fac alt", "fac caption", TestContext.Current.CancellationToken);

        // Assert
        update.IsSuccess.Should().BeTrue();

        var all = await repo.GetMediaPagedAsync(new MediaLibraryQuery { PageSize = 200 }, TestContext.Current.CancellationToken);
        all.Value.Should().NotBeNull();
        all.Value.Items.Should().Contain(m =>
            m.Identifier == SeededFacilityImageIdentifier && m.AltText == "fac alt" && m.Caption == "fac caption");
    }

    [Fact]
    public async Task UpdateImageMetadataAsync_WhenImageMissing_ReturnsNotFound()
    {
        // Arrange
        var repo = new MediaRepository(CreateSeededFactory(SeedFacilityImage), NullLogger<MediaRepository>.Instance);

        // Act
        var result = await repo.UpdateImageMetadataAsync("no-such-image", null, null, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }
}
