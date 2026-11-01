// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services.Media;
using Core.Repositories;
using Core.Repositories.Events;
using Core.Services.Events;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using UnitTests.RepositoryTests;

namespace UnitTests.ServiceTests;

public class EventImageServiceTests : TestBase
{
    private const string User1 = Utilities.Identifiers.User;
    private const string User2 = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
    private const string Uploaded = "events/test-image.jpg";

    private readonly Mock<IMediaUploadService> _media = Utilities.MockFactory.MediaUploadService();
    private readonly Mock<IWebDavService> _webDav = Utilities.MockFactory.WebDavService();

    private EventImageService Service(IDbContextFactory<StigViddDbContext> factory, IEventImageRepository? imageRepository = null)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["PresentableBaseUrl"] = Utilities.Stubs.PresentableBaseUrl })
            .Build();

        return new EventImageService(
            new EventLoader(
                new EventRepository(factory, NullLogger<EventRepository>.Instance),
                new UserRepository(factory, NullLogger<UserRepository>.Instance),
                Utilities.MockFactory.UserBlockServiceHiding().Object),
            imageRepository ?? new EventImageRepository(factory, NullLogger<EventImageRepository>.Instance),
            _media.Object,
            _webDav.Object,
            new EventResponseFactory(configuration),
            NullLogger<EventImageService>.Instance);
    }

    // User 1 organizes event-1, user 2 has joined it. keep-comment: the seed every test starts from
    private static Event Organized(string? imageUrl = null, EventStatus status = EventStatus.Published)
    {
        var e = EventRepositoryTests.NewEvent(1, organizerId: 1, status: status);
        e.Participants.Add(new EventParticipant { UserId = 2, Status = EventParticipantStatus.Joined });
        e.ParticipantCount = 2;

        if (imageUrl is not null)
            e.Image = new EventImage { Identifier = "image-old", ImageUrl = imageUrl };

        return e;
    }

    private static async Task<List<EventImage>> ImagesOf(IDbContextFactory<StigViddDbContext> factory, int eventId)
    {
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        return await context.EventImages.AsNoTracking().Where(i => i.EventId == eventId).ToListAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task SetImageAsync_ByTheOrganizer_StoresTheImageAndReturnsItsUrl()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(Organized()));

        var result = await Service(factory).SetImageAsync(User1, "event-1", Utilities.Stubs.FakeFile(), TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.ImageUrl.Should().Be($"{Utilities.Stubs.PresentableBaseUrl}{Uploaded}");
        var stored = (await ImagesOf(factory, 1)).Should().ContainSingle().Subject;
        stored.Identifier.Should().Be(result.Value.Identifier);
        stored.ImageUrl.Should().Be(Uploaded);
        _media.Verify(m => m.ProcessAndUploadAsync(It.IsAny<Stream>(), "events", ImageProcessingOptions.StripMetadataOnly), Times.Once);
        _webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task SetImageAsync_ReplacesTheOldRowAndDeletesItsFile()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(Organized("events/old.jpeg")));

        var result = await Service(factory).SetImageAsync(User1, "event-1", Utilities.Stubs.FakeFile(), TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        var stored = (await ImagesOf(factory, 1)).Should().ContainSingle().Subject;
        stored.Identifier.Should().NotBe("image-old");
        stored.ImageUrl.Should().Be(Uploaded);
        _webDav.Verify(w => w.DeleteFileAsync("events/old.jpeg"), Times.Once);
    }

    [Fact]
    public async Task SetImageAsync_KeepsAnOldFileAnotherRowStillUses()
    {
        var other = EventRepositoryTests.NewEvent(2, organizerId: 2);
        other.Image = new EventImage { ImageUrl = "/events/shared.jpeg" };
        var factory = CreateSeededFactory(db =>
        {
            db.Events.Add(Organized("events/shared.jpeg"));
            db.Events.Add(other);
        });

        var result = await Service(factory).SetImageAsync(User1, "event-1", Utilities.Stubs.FakeFile(), TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        _webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task SetImageAsync_ByAParticipant_IsRefusedBeforeAnyUpload()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(Organized()));

        var result = await Service(factory).SetImageAsync(User2, "event-1", Utilities.Stubs.FakeFile(), TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.Code.Should().Be(EventErrorCodes.NotAllowed);
        _media.Verify(m => m.ProcessAndUploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<ImageProcessingOptions>()), Times.Never);
    }

    [Fact]
    public async Task SetImageAsync_OnACancelledEvent_IsRefused()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(Organized(status: EventStatus.Cancelled)));

        var result = await Service(factory).SetImageAsync(User1, "event-1", Utilities.Stubs.FakeFile(), TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.Code.Should().Be(EventErrorCodes.EventCancelled);
        _media.Verify(m => m.ProcessAndUploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<ImageProcessingOptions>()), Times.Never);
    }

    [Theory]
    [InlineData(RepositoryResultStatus.NotFound, 404)]
    [InlineData(RepositoryResultStatus.Error, 500)]
    public async Task SetImageAsync_WhenTheRowIsNotSaved_DeletesTheUploadedFile(RepositoryResultStatus status, int statusCode)
    {
        var factory = CreateSeededFactory(db => db.Events.Add(Organized()));
        var images = new Mock<IEventImageRepository>();
        images.Setup(r => r.ReplaceAsync(It.IsAny<int>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(status == RepositoryResultStatus.NotFound ? RepositoryResult<ReplacedEventImage>.NotFound() : RepositoryResult<ReplacedEventImage>.Error());

        var result = await Service(factory, images.Object).SetImageAsync(User1, "event-1", Utilities.Stubs.FakeFile(), TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(statusCode);
        _webDav.Verify(w => w.DeleteFileAsync(Uploaded), Times.Once);
    }

    [Fact]
    public async Task DeleteImageAsync_ByTheOrganizer_RemovesTheRowAndItsFile()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(Organized("events/old.jpeg")));

        var result = await Service(factory).DeleteImageAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        (await ImagesOf(factory, 1)).Should().BeEmpty();
        _webDav.Verify(w => w.DeleteFileAsync("events/old.jpeg"), Times.Once);
    }

    [Fact]
    public async Task DeleteImageAsync_WithNoImage_IsOkAndDeletesNoFile()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(Organized()));

        var result = await Service(factory).DeleteImageAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        _webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task DeleteImageAsync_ByAParticipant_IsRefusedAndKeepsTheImage()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(Organized("events/old.jpeg")));

        var result = await Service(factory).DeleteImageAsync(User2, "event-1", TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.Code.Should().Be(EventErrorCodes.NotAllowed);
        (await ImagesOf(factory, 1)).Should().ContainSingle();
        _webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Never);
    }
}
