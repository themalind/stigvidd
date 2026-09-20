// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using System.Text.Json;

namespace StigviddAPI.BackgroundServices;

// Same shape as MailOutboxDispatcher, minus the retry/backoff ladder — WebDavService already
// retries its own transient network failures, so an item gets one attempt here.
public class MediaReprocessDispatcher : BackgroundService
{
    private readonly IMediaReprocessQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MediaReprocessDispatcher> _logger;

    public MediaReprocessDispatcher(
        IMediaReprocessQueue queue,
        IServiceScopeFactory scopeFactory,
        ILogger<MediaReprocessDispatcher> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await RecoverAsync(stoppingToken);

        await foreach (var itemId in _queue.DequeueAllAsync(stoppingToken))
        {
            try
            {
                await ProcessAsync(itemId, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "MediaReprocessDispatcher: Item {id} could not be processed.", itemId);
            }
        }
    }

    private async Task RecoverAsync(CancellationToken stoppingToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<IMediaReprocessRepository>();

            var reset = await repository.ResetInterruptedAsync(stoppingToken);
            if (reset.IsSuccess && reset.Value > 0)
                _logger.LogInformation("MediaReprocessDispatcher: Reset {count} item(s) interrupted by a restart.", reset.Value);

            var pending = await repository.GetPendingItemIdsAsync(stoppingToken);
            if (!pending.IsSuccess)
            {
                _logger.LogError("MediaReprocessDispatcher: Could not list pending items at startup; queued work will wait for the next restart.");
                return;
            }

            foreach (var id in pending.Value)
                _queue.Enqueue(id);

            if (pending.Value.Count > 0)
                _logger.LogInformation("MediaReprocessDispatcher: Re-queued {count} pending item(s).", pending.Value.Count);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaReprocessDispatcher: Startup recovery failed.");
        }
    }

    private async Task ProcessAsync(int itemId, CancellationToken stoppingToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IMediaReprocessRepository>();
        var mediaRepository = scope.ServiceProvider.GetRequiredService<IMediaRepository>();
        var imageProcessing = scope.ServiceProvider.GetRequiredService<IImageProcessingService>();
        var webDav = scope.ServiceProvider.GetRequiredService<IWebDavService>();

        var claim = await repository.ClaimAsync(itemId, stoppingToken);

        if (claim.Status == RepositoryResultStatus.Conflict)
            return;

        if (!claim.IsSuccess)
        {
            _logger.LogError("MediaReprocessDispatcher: Could not claim item {id}. Status: {status}", itemId, claim.Status);
            return;
        }

        var item = claim.Value;

        try
        {
            var current = await mediaRepository.GetByIdentifiersAsync([item.MediaIdentifier], stoppingToken);
            var source = current.IsSuccess ? current.Value.FirstOrDefault(m => m.Identifier == item.MediaIdentifier) : null;

            if (source is null)
            {
                await repository.MarkFailedAsync(itemId, "The source image no longer exists.", stoppingToken);
                return;
            }

            using var downloaded = await webDav.DownloadFileAsync(source.ImageUrl);
            if (downloaded is null)
            {
                await repository.MarkFailedAsync(itemId, "The source file could not be downloaded from storage.", stoppingToken);
                return;
            }

            var options = ParseOptions(item.Job?.OptionsJson);
            using var processed = imageProcessing.Process(downloaded, options);

            var subDirectory = item.OwnerType == "Trail" ? "trails" : "facilities";
            var uploaded = await webDav.UploadFileAsync(processed.Stream, subDirectory, processed.Extension);

            if (!uploaded.Success || uploaded.Value is null)
            {
                await repository.MarkFailedAsync(itemId, uploaded.Message?.ResultMessage ?? "Upload failed.", stoppingToken);
                return;
            }

            var marked = await repository.MarkSucceededAsync(
                itemId, uploaded.Value, processed.Width, processed.Height, processed.SizeBytes, stoppingToken);

            if (!marked.IsSuccess)
            {
                _logger.LogError("MediaReprocessDispatcher: Uploaded {path} but could not record success for item {id}.", uploaded.Value, itemId);
                return;
            }

            try
            {
                await webDav.DeleteFileAsync(source.ImageUrl);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "MediaReprocessDispatcher: Reprocessed {identifier} but could not delete the old file {path}.", item.MediaIdentifier, source.ImageUrl);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaReprocessDispatcher: Item {id} ({identifier}) failed.", itemId, item.MediaIdentifier);
            await repository.MarkFailedAsync(itemId, ex.Message, stoppingToken);
        }
    }

    private static ImageProcessingOptions ParseOptions(string? optionsJson) =>
        string.IsNullOrWhiteSpace(optionsJson)
            ? new ImageProcessingOptions()
            : JsonSerializer.Deserialize<ImageProcessingOptions>(optionsJson) ?? new ImageProcessingOptions();
}
