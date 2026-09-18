// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Enums;
using Microsoft.Extensions.Logging;
using WebDataContracts.RequestModels.MailOutbox;
using WebDataContracts.ResponseModels.MailOutbox;

namespace Core.Services;

public class MailOutboxAdminService : IMailOutboxAdminService
{
    private const int DefaultPageSize = 25;
    private const int MaxPageSize = 100;

    private readonly IMailOutboxRepository _repository;
    private readonly IMailOutboxQueue _queue;
    private readonly MailOutboxResponseFactory _factory;
    private readonly ILogger<MailOutboxAdminService> _logger;

    public MailOutboxAdminService(
        IMailOutboxRepository repository,
        IMailOutboxQueue queue,
        MailOutboxResponseFactory factory,
        ILogger<MailOutboxAdminService> logger)
    {
        _repository = repository;
        _queue = queue;
        _factory = factory;
        _logger = logger;
    }

    public async Task<Result<PagedResult<OutboxEmailSummaryResponse>>> GetPagedAsync(
        string? status, string? templateKey, string? recipient, int page, int pageSize, CancellationToken ctoken)
    {
        // An unrecognised filter is a 400 rather than a silently ignored one: reading a full
        // outbox as an empty one is the worst answer this endpoint could give.
        if (!TryParseStatus(status, out var parsedStatus))
            return BadFilter<PagedResult<OutboxEmailSummaryResponse>>(
                nameof(status), Enum.GetNames<OutboxEmailStatus>());

        var result = await _repository.GetPagedAsync(
            parsedStatus, templateKey, recipient, Math.Max(page, 1), ClampPageSize(pageSize), ctoken);

        if (!result.IsSuccess)
            return Result.Fail<PagedResult<OutboxEmailSummaryResponse>>(
                new Message(500, "The outbox could not be listed."));

        var paged = result.Value;

        return Result.Ok(new PagedResult<OutboxEmailSummaryResponse>(
            _factory.Create(paged.Items), paged.Page, paged.HasMore, paged.TotalCount));
    }

    public async Task<Result<OutboxEmailDetailResponse>> GetDetailAsync(
        string identifier, CancellationToken ctoken)
    {
        var result = await _repository.GetByIdentifierAsync(identifier, ctoken);

        if (result.Status == RepositoryResultStatus.NotFound)
            return NotFound<OutboxEmailDetailResponse>();

        if (!result.IsSuccess)
            return Result.Fail<OutboxEmailDetailResponse>(new Message(500, "The mail could not be read."));

        return Result.Ok(_factory.Create(result.Value));
    }

    public async Task<Result<MailOutboxCountsResponse>> GetCountsAsync(CancellationToken ctoken)
    {
        var result = await _repository.GetCountsByStatusAsync(ctoken);

        if (!result.IsSuccess)
            return Result.Fail<MailOutboxCountsResponse>(new Message(500, "The outbox could not be counted."));

        return Result.Ok(_factory.Create(result.Value));
    }

    public async Task<Result<OutboxEmailDetailResponse>> RetryAsync(
        string identifier, CancellationToken ctoken)
    {
        var result = await _repository.RequeueAsync(identifier, ctoken);

        if (result.Status == RepositoryResultStatus.NotFound)
            return NotFound<OutboxEmailDetailResponse>();

        if (result.Status == RepositoryResultStatus.Conflict)
            return Result.Fail<OutboxEmailDetailResponse>(new Message(
                409,
                "Only mail that has failed or been cancelled can be retried. Mail that is being "
                    + "sent right now cannot — try again in a moment."));

        if (!result.IsSuccess)
            return Result.Fail<OutboxEmailDetailResponse>(new Message(500, "The mail could not be retried."));

        // Write, THEN signal -- the same ordering EnqueueAsync uses, and for the same reason.
        // Signalling first would hand the dispatcher an id whose row is still Failed, ClaimAsync
        // would report Conflict, and the mail would sit until the next restart.
        //
        // That the signal is best-effort is exactly why the retry is expressed as a status
        // change: the row is Pending now, so the dispatcher's boot sweep recovers it even if
        // this signal is lost.
        _queue.Enqueue(result.Value.Id);

        _logger.LogInformation("Mail {identifier} was requeued from the admin outbox.", identifier);

        return Result.Ok(_factory.Create(result.Value));
    }

    public async Task<Result<OutboxEmailDetailResponse>> CancelAsync(
        string identifier, CancellationToken ctoken)
    {
        var result = await _repository.CancelAsync(identifier, ctoken);

        if (result.Status == RepositoryResultStatus.NotFound)
            return NotFound<OutboxEmailDetailResponse>();

        if (result.Status == RepositoryResultStatus.Conflict)
            return Result.Fail<OutboxEmailDetailResponse>(new Message(
                409,
                "Only mail that is still waiting can be cancelled. Mail that is being sent, has "
                    + "been sent, has failed or is already cancelled cannot."));

        if (!result.IsSuccess)
            return Result.Fail<OutboxEmailDetailResponse>(new Message(500, "The mail could not be cancelled."));

        // No queue signal. A signal for this id may already be sitting in the channel and there
        // is no way to retract it -- nor any need, because claiming is a Pending -> Sending
        // transition and this row is no longer Pending.
        _logger.LogInformation("Mail {identifier} was cancelled from the admin outbox.", identifier);

        return Result.Ok(_factory.Create(result.Value));
    }

    public async Task<Result<MailOutboxPurgeResponse>> PurgeAsync(
        PurgeMailOutboxRequest request, CancellationToken ctoken)
    {
        var cutoff = DateTime.UtcNow.AddDays(-request.OlderThanDays);

        var result = await _repository.PurgeSentBeforeAsync(cutoff, ctoken);

        if (!result.IsSuccess)
            return Result.Fail<MailOutboxPurgeResponse>(new Message(500, "The outbox could not be purged."));

        _logger.LogWarning(
            "{Deleted} sent mail(s) older than {Cutoff} were purged from the admin outbox.",
            result.Value, cutoff);

        return Result.Ok(MailOutboxPurgeResponse.Create(result.Value, request.OlderThanDays, cutoff));
    }

    private static Result<T> NotFound<T>() =>
        Result.Fail<T>(new Message(404, "No such mail."));

    private static Result<T> BadFilter<T>(string name, string[] allowed) =>
        Result.Fail<T>(new Message(400, $"Unknown {name}. Use one of: {string.Join(", ", allowed)}."));

    private static int ClampPageSize(int pageSize) =>
        pageSize <= 0 ? DefaultPageSize : Math.Min(pageSize, MaxPageSize);

    private static bool TryParseStatus(string? value, out OutboxEmailStatus? parsed)
    {
        parsed = null;

        if (string.IsNullOrWhiteSpace(value))
            return true;

        if (!Enum.TryParse<OutboxEmailStatus>(value, ignoreCase: true, out var result) || !Enum.IsDefined(result))
            return false;

        parsed = result;
        return true;
    }
}
