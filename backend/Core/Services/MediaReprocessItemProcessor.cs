// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace Core.Services;

public class MediaReprocessItemProcessor
{
    private readonly IMediaReprocessRepository _repository;
    private readonly IMediaRepository _mediaRepository;
    private readonly IImageProcessingService _imageProcessing;
    private readonly IWebDavService _webDav;
    private readonly ILogger<MediaReprocessItemProcessor> _logger;

    public MediaReprocessItemProcessor(
        IMediaReprocessRepository repository,
        IMediaRepository mediaRepository,
        IImageProcessingService imageProcessing,
        IWebDavService webDav,
        ILogger<MediaReprocessItemProcessor> logger)
    {
        _repository = repository;
        _mediaRepository = mediaRepository;
        _imageProcessing = imageProcessing;
        _webDav = webDav;
        _logger = logger;
    }

    public async Task ProcessAsync(int itemId, CancellationToken ctoken)
    {
        var claim = await _repository.ClaimAsync(itemId, ctoken);

        if (claim.Status == RepositoryResultStatus.Conflict)
            return;

        if (!claim.IsSuccess)
        {
            _logger.LogError("MediaReprocessItemProcessor: Could not claim item {id}. Status: {status}", itemId, claim.Status);
            return;
        }

        var item = claim.Value;
        var stage = "Lookup";

        try
        {
            var current = await _mediaRepository.GetByIdentifiersAsync([item.MediaIdentifier], ctoken);
            var source = current.IsSuccess ? current.Value.FirstOrDefault(m => m.Identifier == item.MediaIdentifier) : null;

            if (source is null)
            {
                await _repository.MarkFailedAsync(itemId, "Lookup: the source image no longer exists.", ctoken);
                return;
            }

            stage = "Download";
            var downloaded = await _webDav.DownloadAsync(source.ImageUrl);
            if (!downloaded.Success || downloaded.Value is null)
            {
                await _repository.MarkFailedAsync(
                    itemId, $"Download: {downloaded.Message?.ResultMessage ?? source.ImageUrl}", ctoken);
                return;
            }

            using var sourceStream = downloaded.Value;

            stage = "Decode";
            var options = ParseOptions(item.Job?.OptionsJson);
            using var processed = _imageProcessing.Process(sourceStream, options);

            stage = "Upload";
            var subDirectory = TargetDirectory(source.ImageUrl, item.OwnerType);
            var uploaded = await _webDav.UploadFileAsync(processed.Stream, subDirectory, processed.Extension);

            if (!uploaded.Success || uploaded.Value is null)
            {
                await _repository.MarkFailedAsync(itemId, $"Upload: {uploaded.Message?.ResultMessage ?? "failed"}", ctoken);
                return;
            }

            stage = "Save";
            var marked = await _repository.MarkSucceededAsync(
                itemId, source.ImageUrl, uploaded.Value, processed.Width, processed.Height, processed.SizeBytes, ctoken);

            if (!marked.IsSuccess)
            {
                _logger.LogError("MediaReprocessItemProcessor: Uploaded {path} but could not record success for item {id}. Status: {status}", uploaded.Value, itemId, marked.Status);
                await DiscardUploadAsync(uploaded.Value);
                await _repository.MarkFailedAsync(
                    itemId,
                    marked.Status == RepositoryResultStatus.NotFound
                        ? "Save: the image was removed while processing."
                        : "Save: could not record the result.",
                    ctoken);
                return;
            }

            if (marked.Value.OldFileStillReferenced)
            {
                _logger.LogInformation(
                    "MediaReprocessItemProcessor: Kept {path}; it is still referenced outside trail/facility images.", source.ImageUrl);
                return;
            }

            try
            {
                await _webDav.DeleteFileAsync(source.ImageUrl);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "MediaReprocessItemProcessor: Reprocessed {identifier} but could not delete the old file {path}.", item.MediaIdentifier, source.ImageUrl);
            }
        }
        catch (OperationCanceledException) when (ctoken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaReprocessItemProcessor: Item {id} ({identifier}) failed at {stage}.", itemId, item.MediaIdentifier, stage);
            await _repository.MarkFailedAsync(itemId, $"{stage}: {Describe(ex)}", ctoken);
        }
    }

    // keep-comment: the upload has a fresh GUID name nothing references, so it is safe to delete - unlike the source
    private async Task DiscardUploadAsync(string uploadedPath)
    {
        try
        {
            await _webDav.DeleteFileAsync(uploadedPath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "MediaReprocessItemProcessor: Could not delete the unrecorded upload {path}.", uploadedPath);
        }
    }

    // keep-comment: the innermost exception carries the cause - WebDavService wraps a reset/timeout as "Error uploading file", which alone says nothing
    public static string Describe(Exception ex)
    {
        var innermost = ex;
        while (innermost.InnerException is not null)
            innermost = innermost.InnerException;

        return ReferenceEquals(innermost, ex)
            ? $"{ex.GetType().Name}: {ex.Message}"
            : $"{ex.Message} ({innermost.GetType().Name}: {innermost.Message})";
    }

    // keep-comment: the result stays in the source's folder because the app labels placeholders by "mock" in the URL (app/src/utils/is-mock-image.ts) - a mock/ image moved to trails/ would lose its "Example image" badge
    public static string TargetDirectory(string sourcePath, string ownerType)
    {
        var relative = sourcePath.TrimStart('/');
        var lastSlash = relative.LastIndexOf('/');

        if (lastSlash > 0)
            return relative[..lastSlash];

        return ownerType == "Trail" ? "trails" : "facilities";
    }

    private static ImageProcessingOptions ParseOptions(string? optionsJson) =>
        string.IsNullOrWhiteSpace(optionsJson)
            ? new ImageProcessingOptions()
            : JsonSerializer.Deserialize<ImageProcessingOptions>(optionsJson) ?? new ImageProcessingOptions();
}
