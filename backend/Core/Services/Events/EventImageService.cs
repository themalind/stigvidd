// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Interfaces.Services.Media;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System.Runtime.CompilerServices;
using WebDataContracts.ResponseModels.Event;

namespace Core.Services.Events;

public class EventImageService : IEventImageService
{
    // Every screen shows a cover as a 2:1 strip, so the rest of the picture is never seen. keep-comment: why covers are cut to 2:1
    public const double CoverAspect = 2;
    public const int CoverMaxWidth = 1080;

    public static ImageProcessingOptions CoverOptions(double? focusY)
    {
        return new ImageProcessingOptions { AspectCrop = new AspectCrop(CoverAspect, focusY ?? 0.5), MaxWidth = CoverMaxWidth };
    }

    private readonly EventLoader _loader;
    private readonly IEventImageRepository _imageRepository;
    private readonly IMediaUploadService _mediaUploadService;
    private readonly IWebDavService _webDavService;
    private readonly EventResponseFactory _factory;
    private readonly ILogger<EventImageService> _logger;

    public EventImageService(
        EventLoader loader,
        IEventImageRepository imageRepository,
        IMediaUploadService mediaUploadService,
        IWebDavService webDavService,
        EventResponseFactory factory,
        ILogger<EventImageService> logger)
    {
        _loader = loader;
        _imageRepository = imageRepository;
        _mediaUploadService = mediaUploadService;
        _webDavService = webDavService;
        _factory = factory;
        _logger = logger;
    }

    public async Task<Result<EventImageResponse>> SetImageAsync(string userIdentifier, string identifier, IFormFile image, double? focusY, CancellationToken ctoken)
    {
        if (focusY is double focus && !(focus >= 0 && focus <= 1))
            return Result.Fail<EventImageResponse>(new Message(400, "focusY must be between 0 and 1."));

        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail<EventImageResponse>(loaded.Message ?? EventErrors.Gone());

        if (loaded.Value.Membership.EditRefusal() is Message refusal)
            return Result.Fail<EventImageResponse>(refusal);

        await using var stream = image.OpenReadStream();
        var upload = await _mediaUploadService.ProcessAndUploadAsync(stream, "events", CoverOptions(focusY));

        if (upload.IsFailure || upload.Value is null)
            return Result.Fail<EventImageResponse>(new Message(500, "Could not upload the image. Try again later."));

        var replaced = await _imageRepository.ReplaceAsync(loaded.Value.Detail.Event.Id, upload.Value.Path, ctoken);

        if (!replaced.IsSuccess || replaced.Value is null)
        {
            await DeleteFileAsync(upload.Value.Path, identifier);

            return replaced.Status == RepositoryResultStatus.NotFound
                ? Result.Fail<EventImageResponse>(EventErrors.Gone())
                : Result.Fail<EventImageResponse>(new Message(500, "An error occurred while saving the image."));
        }

        if (replaced.Value.RemovedImageUrl is string removed)
            await DeleteFileAsync(removed, identifier);

        return Result.Ok(_factory.CreateImage(replaced.Value.Identifier, upload.Value.Path));
    }

    public async Task<Result> DeleteImageAsync(string userIdentifier, string identifier, CancellationToken ctoken)
    {
        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail(loaded.Message ?? EventErrors.Gone());

        if (loaded.Value.Membership.EditRefusal() is Message refusal)
            return Result.Fail(refusal);

        var deleted = await _imageRepository.DeleteAsync(loaded.Value.Detail.Event.Id, ctoken);

        if (!deleted.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while deleting the image."));

        if (deleted.Value is string removed)
            await DeleteFileAsync(removed, identifier);

        return Result.Ok();
    }

    private Task DeleteFileAsync(string url, string eventIdentifier, [CallerMemberName] string operation = "")
    {
        return EventImageFiles.DeleteAsync(_webDavService, _logger, url, eventIdentifier, $"EventImageService: {operation}");
    }
}
