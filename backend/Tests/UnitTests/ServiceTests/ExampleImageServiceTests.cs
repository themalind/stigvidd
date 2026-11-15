// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Core.Interfaces.Repositories.Trails.Models;
using Core.Interfaces.Services;
using Core.Services.Media;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace UnitTests.ServiceTests;

public class ExampleImageServiceTests
{
    private readonly Mock<IWebDavService> _webDav = new();
    private readonly Mock<IImageProcessingService> _imageProcessing = new();
    private readonly Mock<ITrailRepository> _trails = new();

    private ExampleImageService Build()
    {
        return new ExampleImageService(
            _webDav.Object, _imageProcessing.Object, _trails.Object, NullLogger<ExampleImageService>.Instance);
    }

    private void InMock(params string[] paths)
    {
        _webDav.Setup(w => w.ListFilesAsync("mock")).ReturnsAsync(Result.Ok<IReadOnlyCollection<string>>(paths));
    }

    [Fact]
    public async Task AddToTrailsAsync_GivesEveryTrailEachReadableImage_WithItsMeasuredSize()
    {
        InMock("mock/a.jpg", "mock/broken.jpg", "mock/notes.txt");
        _webDav.Setup(w => w.DownloadAsync("mock/a.jpg")).ReturnsAsync(() => Result.Ok<Stream>(new MemoryStream(new byte[7])));
        _webDav.Setup(w => w.DownloadAsync("mock/broken.jpg")).ReturnsAsync(Result.Fail<Stream>(new Message(404, "gone")));
        _imageProcessing.Setup(p => p.Measure(It.IsAny<Stream>())).Returns(new ImageDimensions(40, 30));
        _trails.Setup(t => t.AddMissingTrailImagesAsync(It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<IReadOnlyCollection<ExampleImageFile>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        var result = await Build().AddToTrailsAsync([1, 2], TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        _webDav.Verify(w => w.DownloadAsync("mock/notes.txt"), Times.Never);
        _trails.Verify(t => t.AddMissingTrailImagesAsync(
            It.Is<IReadOnlyCollection<int>>(ids => ids.SequenceEqual(new[] { 1, 2 })),
            It.Is<IReadOnlyCollection<ExampleImageFile>>(files => files.SequenceEqual(new[] { new ExampleImageFile("mock/a.jpg", 40, 30, 7) })),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AddToTrailsAsync_WhenMockHoldsNoImages_FailsWithoutWriting()
    {
        InMock("mock/notes.txt");

        var result = await Build().AddToTrailsAsync([1], TestContext.Current.CancellationToken);

        result.Success.Should().BeFalse();
        _trails.Verify(t => t.AddMissingTrailImagesAsync(It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<IReadOnlyCollection<ExampleImageFile>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AddToTrailsAsync_ForNoTrails_DoesNotReadTheFolder()
    {
        var result = await Build().AddToTrailsAsync([], TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        _webDav.Verify(w => w.ListFilesAsync(It.IsAny<string>()), Times.Never);
    }
}
