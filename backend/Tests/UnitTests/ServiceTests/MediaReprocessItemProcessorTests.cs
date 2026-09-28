// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace UnitTests.ServiceTests;

public class MediaReprocessItemProcessorTests
{
    private const int ItemId = 7;
    private const string SourcePath = "mock/placeholder.jpg";
    private const string NewPath = "trails/new.webp";

    private readonly Mock<IMediaReprocessRepository> _reprocess = new();
    private readonly Mock<IMediaRepository> _media = new();
    private readonly Mock<IImageProcessingService> _imaging = new();
    private readonly Mock<IWebDavService> _webDav = new();

    public MediaReprocessItemProcessorTests()
    {
        _reprocess.Setup(r => r.ClaimAsync(ItemId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<MediaReprocessItem>.Success(new MediaReprocessItem
            {
                Id = ItemId,
                MediaIdentifier = "media-1",
                OwnerType = "Trail",
                Status = MediaReprocessItemStatus.Processing,
            }));

        _media.Setup(m => m.GetByIdentifiersAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<MediaLookupProjection>>.Success(
                [new MediaLookupProjection("media-1", "Trail", SourcePath)]));

        _webDav.Setup(w => w.DownloadAsync(SourcePath))
            .ReturnsAsync(() => Result.Ok<Stream>(new MemoryStream([1, 2, 3])));

        _imaging.Setup(i => i.Process(It.IsAny<Stream>(), It.IsAny<ImageProcessingOptions>()))
            .Returns(() => new ProcessedImage
            {
                Stream = new MemoryStream([4, 5]),
                Extension = "webp",
                ContentType = "image/webp",
                Width = 800,
                Height = 600,
                SizeBytes = 2,
            });

        _webDav.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), "mock", "webp"))
            .ReturnsAsync(Result.Ok<string?>(NewPath));

        _webDav.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ReturnsAsync(Result.Ok(true));
    }

    private MediaReprocessItemProcessor Build() =>
        new(_reprocess.Object, _media.Object, _imaging.Object, _webDav.Object, NullLogger<MediaReprocessItemProcessor>.Instance);

    private void SucceedsWith(bool stillReferenced) =>
        _reprocess.Setup(r => r.MarkSucceededAsync(
                ItemId, SourcePath, NewPath, 800, 600, 2, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<MediaReprocessSuccess>.Success(new MediaReprocessSuccess(3, stillReferenced)));

    [Fact]
    public async Task ProcessAsync_PassesTheOldPathToTheSuccess_AndDeletesTheOldFileOnceNothingUsesIt()
    {
        // Arrange
        SucceedsWith(stillReferenced: false);

        // Act
        await Build().ProcessAsync(ItemId, TestContext.Current.CancellationToken);

        // Assert
        _reprocess.Verify(r => r.MarkSucceededAsync(
            ItemId, SourcePath, NewPath, 800, 600, 2, It.IsAny<CancellationToken>()), Times.Once);
        _webDav.Verify(w => w.DeleteFileAsync(SourcePath), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_WhenTheOldFileIsStillReferenced_DoesNotDeleteIt()
    {
        // Arrange
        SucceedsWith(stillReferenced: true);

        // Act
        await Build().ProcessAsync(ItemId, TestContext.Current.CancellationToken);

        // Assert
        _webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Never);
    }

    [Theory]
    [InlineData(RepositoryResultStatus.Error, "Save: could not record the result.")]
    [InlineData(RepositoryResultStatus.NotFound, "Save: the image was removed while processing.")]
    public async Task ProcessAsync_WhenTheSuccessCannotBeRecorded_DiscardsTheUpload_KeepsTheSource_AndFailsTheItem(
        RepositoryResultStatus status, string expectedError)
    {
        // Arrange
        _reprocess.Setup(r => r.MarkSucceededAsync(
                It.IsAny<int>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<long>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(status == RepositoryResultStatus.NotFound
                ? RepositoryResult<MediaReprocessSuccess>.NotFound()
                : RepositoryResult<MediaReprocessSuccess>.Error());

        // Act
        await Build().ProcessAsync(ItemId, TestContext.Current.CancellationToken);

        // Assert
        _webDav.Verify(w => w.DeleteFileAsync(NewPath), Times.Once);
        _webDav.Verify(w => w.DeleteFileAsync(SourcePath), Times.Never);
        _reprocess.Verify(r => r.MarkFailedAsync(ItemId, expectedError, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_WhenTheDownloadFails_RecordsTheStageAndTheStatus()
    {
        // Arrange
        _webDav.Setup(w => w.DownloadAsync(SourcePath))
            .ReturnsAsync(Result.Fail<Stream>(new Message(404, "404 Not Found")));

        // Act
        await Build().ProcessAsync(ItemId, TestContext.Current.CancellationToken);

        // Assert
        _reprocess.Verify(r => r.MarkFailedAsync(
            ItemId, "Download: 404 Not Found", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_WhenDecodingThrows_RecordsTheStageAndTheMessage()
    {
        // Arrange
        _imaging.Setup(i => i.Process(It.IsAny<Stream>(), It.IsAny<ImageProcessingOptions>()))
            .Throws(new InvalidDataException("not an image"));

        // Act
        await Build().ProcessAsync(ItemId, TestContext.Current.CancellationToken);

        // Assert
        _reprocess.Verify(r => r.MarkFailedAsync(
            ItemId, "Decode: InvalidDataException: not an image", It.IsAny<CancellationToken>()), Times.Once);
        _webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public void Describe_AWrappedException_NamesTheInnermostCause()
    {
        // Arrange
        var wrapped = new Exception("Error uploading file", new IOException("Connection reset by peer"));

        // Act
        var described = MediaReprocessItemProcessor.Describe(wrapped);

        // Assert
        described.Should().Be("Error uploading file (IOException: Connection reset by peer)");
    }

    [Fact]
    public async Task ProcessAsync_UploadsTheResultBesideTheSource_SoAPlaceholderKeepsMockInItsPath()
    {
        // Arrange
        SucceedsWith(stillReferenced: false);

        // Act
        await Build().ProcessAsync(ItemId, TestContext.Current.CancellationToken);

        // Assert
        _webDav.Verify(w => w.UploadFileAsync(It.IsAny<Stream>(), "mock", "webp"), Times.Once);
        _webDav.Verify(w => w.UploadFileAsync(It.IsAny<Stream>(), "trails", It.IsAny<string>()), Times.Never);
    }

    [Theory]
    [InlineData("mock/gesebol/20250824100243.jpg", "Trail", "mock/gesebol")]
    [InlineData("mock/vindskydd_mock.jpg", "Trail", "mock")]
    [InlineData("trails/kransmossen_20260523_9.jpg", "Trail", "trails")]
    [InlineData("/trails/hedared_20260524_1.jpg", "Trail", "trails")]
    [InlineData("facilities/abc.jpeg", "Facility", "facilities")]
    [InlineData("loose.jpg", "Trail", "trails")]
    [InlineData("/loose.jpg", "Facility", "facilities")]
    public void TargetDirectory_KeepsTheSourcesFolder_OrFallsBackByOwner(string source, string ownerType, string expected)
    {
        // Act
        var directory = MediaReprocessItemProcessor.TargetDirectory(source, ownerType);

        // Assert
        directory.Should().Be(expected);
    }
}
