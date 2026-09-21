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
        CreateMediaReprocessJobRequest request,
        CancellationToken ctoken)
    {
        var hasIdentifiers = request.MediaIdentifiers is { Count: > 0 };

        if (hasIdentifiers == (request.Filter is not null))
        {
            _logger.LogWarning("MediaReprocessService: EnqueueBatchAsync -> Refused a batch that named neither or both of identifiers and filter.");
            return Result.Fail<MediaReprocessJobSummaryResponse>(new Message(
                (int)HttpStatusCode.BadRequest,
                "Send either mediaIdentifiers or filter - exactly one, not both and not neither."));
        }

        var resolution = request.Filter is not null
            ? await ResolveByFilterAsync(request.Filter, ctoken)
            : await ResolveByIdentifiersAsync(request.MediaIdentifiers ?? [], ctoken);

        if (!resolution.Success)
            return Result.Fail<MediaReprocessJobSummaryResponse>(
                resolution.Message ?? new Message((int)HttpStatusCode.InternalServerError, "An error occurred while validating the batch."));

        var targets = resolution.Value ?? [];

        var processingOptions = request.Options.ToOptions();
        var optionsJson = JsonSerializer.Serialize(processingOptions);

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

    private async Task<Result<IReadOnlyCollection<(string MediaIdentifier, string OwnerType)>>> ResolveByIdentifiersAsync(
        IReadOnlyCollection<string> mediaIdentifiers, CancellationToken ctoken)
    {
        var requested = mediaIdentifiers.Distinct().ToList();

        var lookup = await _mediaRepository.GetByIdentifiersAsync(requested, ctoken);
        if (!lookup.IsSuccess)
        {
            _logger.LogError("MediaReprocessService: ResolveByIdentifiersAsync -> Failed to resolve the requested media identifiers.");
            return Result.Fail<IReadOnlyCollection<(string, string)>>(
                new Message((int)HttpStatusCode.InternalServerError, "An error occurred while validating the batch."));
        }

        var resolved = lookup.Value.ToDictionary(m => m.Identifier, m => m.OwnerType);
        var unresolved = requested.Where(id => !resolved.ContainsKey(id)).ToList();

        if (unresolved.Count > 0)
        {
            _logger.LogWarning(
                "MediaReprocessService: ResolveByIdentifiersAsync -> Refused a batch with {count} unresolved identifier(s).", unresolved.Count);
            return Result.Fail<IReadOnlyCollection<(string, string)>>(new Message(
                (int)HttpStatusCode.BadRequest,
                $"These identifiers are not a Trail or Facility image and cannot be batch-reprocessed: {string.Join(", ", unresolved)}"));
        }

        IReadOnlyCollection<(string, string)> targets = requested
            .Select(id => (MediaIdentifier: id, OwnerType: resolved[id]))
            .ToList();

        return Result.Ok(targets);
    }

    private async Task<Result<IReadOnlyCollection<(string MediaIdentifier, string OwnerType)>>> ResolveByFilterAsync(
        MediaFilter filter, CancellationToken ctoken)
    {
        var matching = await _mediaRepository.GetMatchingAsync(
            filter, MediaReprocessLimits.MaxFilterBatchSize + 1, ctoken);

        if (!matching.IsSuccess)
        {
            _logger.LogError("MediaReprocessService: ResolveByFilterAsync -> Failed to expand the filter.");
            return Result.Fail<IReadOnlyCollection<(string, string)>>(
                new Message((int)HttpStatusCode.InternalServerError, "An error occurred while validating the batch."));
        }

        if (matching.Value.Count == 0)
        {
            return Result.Fail<IReadOnlyCollection<(string, string)>>(new Message(
                (int)HttpStatusCode.BadRequest, "No images match that filter."));
        }

        // keep-comment: refused rather than truncated - a silently shortened batch leaves the operator believing the library is done, and no record of which images were left out
        if (matching.Value.Count > MediaReprocessLimits.MaxFilterBatchSize)
        {
            _logger.LogWarning(
                "MediaReprocessService: ResolveByFilterAsync -> Refused a filter matching more than {cap} images.",
                MediaReprocessLimits.MaxFilterBatchSize);
            return Result.Fail<IReadOnlyCollection<(string, string)>>(new Message(
                (int)HttpStatusCode.BadRequest,
                $"That filter matches more than {MediaReprocessLimits.MaxFilterBatchSize} images. Narrow it - the browse page shows the count before you submit."));
        }

        IReadOnlyCollection<(string, string)> targets = matching.Value
            .Select(m => (MediaIdentifier: m.Identifier, OwnerType: m.OwnerType))
            .ToList();

        return Result.Ok(targets);
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
