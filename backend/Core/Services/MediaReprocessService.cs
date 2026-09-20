// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Text.Json;
using WebDataContracts.RequestModels.Media;
using WebDataContracts.ResponseModels.Media;

namespace Core.Services;

public class MediaReprocessService : IMediaReprocessService
{
    private readonly IMediaReprocessRepository _reprocessRepository;
    private readonly IMediaRepository _mediaRepository;
    private readonly IMediaReprocessQueue _queue;
    private readonly ILogger<MediaReprocessService> _logger;

    public MediaReprocessService(
        IMediaReprocessRepository reprocessRepository,
        IMediaRepository mediaRepository,
        IMediaReprocessQueue queue,
        ILogger<MediaReprocessService> logger)
    {
        _reprocessRepository = reprocessRepository;
        _mediaRepository = mediaRepository;
        _queue = queue;
        _logger = logger;
    }

    public async Task<Result<MediaReprocessJobSummaryResponse>> EnqueueBatchAsync(
        IReadOnlyCollection<string> mediaIdentifiers,
        ImageProcessingOptionsRequest options,
        CancellationToken ctoken)
    {
        var requested = mediaIdentifiers.Distinct().ToList();

        var lookup = await _mediaRepository.GetByIdentifiersAsync(requested, ctoken);
        if (!lookup.IsSuccess)
        {
            _logger.LogError("MediaReprocessService: EnqueueBatchAsync -> Failed to resolve the requested media identifiers.");
            return Result.Fail<MediaReprocessJobSummaryResponse>(
                new Message((int)HttpStatusCode.InternalServerError, "An error occurred while validating the batch."));
        }

        var resolved = lookup.Value.ToDictionary(m => m.Identifier, m => m.OwnerType);
        var unresolved = requested.Where(id => !resolved.ContainsKey(id)).ToList();

        if (unresolved.Count > 0)
        {
            _logger.LogWarning(
                "MediaReprocessService: EnqueueBatchAsync -> Refused a batch with {count} unresolved identifier(s).", unresolved.Count);
            return Result.Fail<MediaReprocessJobSummaryResponse>(new Message(
                (int)HttpStatusCode.BadRequest,
                $"These identifiers are not a Trail or Facility image and cannot be batch-reprocessed: {string.Join(", ", unresolved)}"));
        }

        var processingOptions = options.ToOptions();
        var optionsJson = JsonSerializer.Serialize(processingOptions);
        var targets = requested.Select(id => (MediaIdentifier: id, OwnerType: resolved[id])).ToList();

        var created = await _reprocessRepository.CreateJobAsync(optionsJson, targets, ctoken);
        if (!created.IsSuccess)
        {
            _logger.LogError("MediaReprocessService: EnqueueBatchAsync -> Failed to create a batch reprocess job.");
            return Result.Fail<MediaReprocessJobSummaryResponse>(
                new Message((int)HttpStatusCode.InternalServerError, "An error occurred while creating the batch."));
        }

        var job = created.Value;

        foreach (var item in job.Items)
            _queue.Enqueue(item.Id);

        return Result.Ok(MediaReprocessJobSummaryResponse.Create(
            job.Identifier, job.Items.Count, job.Items.Count, 0, 0, 0, 0, job.CreatedAt, job.LastUpdatedAt));
    }

    public async Task<Result<PagedResult<MediaReprocessJobSummaryResponse>>> GetJobsPagedAsync(
        int page, int pageSize, CancellationToken ctoken)
    {
        var result = await _reprocessRepository.GetJobsPagedAsync(page, pageSize, ctoken);

        if (!result.IsSuccess)
            return Result.Fail<PagedResult<MediaReprocessJobSummaryResponse>>(
                new Message((int)HttpStatusCode.InternalServerError, "An error occurred while listing batch reprocess jobs."));

        var items = result.Value.Items.Select(ToSummary).ToList();

        return Result.Ok(new PagedResult<MediaReprocessJobSummaryResponse>(
            items, result.Value.Page, result.Value.HasMore, result.Value.TotalCount));
    }

    public async Task<Result<MediaReprocessJobDetailResponse>> GetJobDetailAsync(string identifier, CancellationToken ctoken)
    {
        var counts = await _reprocessRepository.GetJobCountsAsync(identifier, ctoken);
        if (counts.Status == RepositoryResultStatus.NotFound)
            return Result.Fail<MediaReprocessJobDetailResponse>(
                new Message((int)HttpStatusCode.NotFound, $"Batch reprocess job {identifier} not found."));

        if (!counts.IsSuccess)
            return Result.Fail<MediaReprocessJobDetailResponse>(
                new Message((int)HttpStatusCode.InternalServerError, "An error occurred while reading the batch."));

        var items = await _reprocessRepository.GetJobItemsAsync(identifier, ctoken);
        if (!items.IsSuccess)
            return Result.Fail<MediaReprocessJobDetailResponse>(
                new Message((int)HttpStatusCode.InternalServerError, "An error occurred while reading the batch's items."));

        var itemResponses = items.Value
            .Select(i => MediaReprocessItemResponse.Create(
                i.Identifier, i.MediaIdentifier, i.OwnerType, i.Status.ToString(), i.LastError, i.CreatedAt, i.LastUpdatedAt))
            .ToList();

        return Result.Ok(MediaReprocessJobDetailResponse.Create(ToSummary(counts.Value), itemResponses));
    }

    public async Task<Result<MediaReprocessJobSummaryResponse>> CancelJobAsync(string identifier, CancellationToken ctoken)
    {
        var cancelled = await _reprocessRepository.CancelPendingItemsAsync(identifier, ctoken);
        if (cancelled.Status == RepositoryResultStatus.NotFound)
            return Result.Fail<MediaReprocessJobSummaryResponse>(
                new Message((int)HttpStatusCode.NotFound, $"Batch reprocess job {identifier} not found."));

        if (!cancelled.IsSuccess)
            return Result.Fail<MediaReprocessJobSummaryResponse>(
                new Message((int)HttpStatusCode.InternalServerError, "An error occurred while cancelling the batch."));

        var counts = await _reprocessRepository.GetJobCountsAsync(identifier, ctoken);
        if (!counts.IsSuccess)
            return Result.Fail<MediaReprocessJobSummaryResponse>(
                new Message((int)HttpStatusCode.InternalServerError, "An error occurred while reading the batch after cancelling it."));

        return Result.Ok(ToSummary(counts.Value));
    }

    private static MediaReprocessJobSummaryResponse ToSummary(MediaReprocessJobCounts counts) =>
        MediaReprocessJobSummaryResponse.Create(
            counts.Identifier,
            counts.TotalCount,
            counts.PendingCount,
            counts.ProcessingCount,
            counts.SucceededCount,
            counts.FailedCount,
            counts.CancelledCount,
            counts.CreatedAt,
            counts.LastUpdatedAt);
}
