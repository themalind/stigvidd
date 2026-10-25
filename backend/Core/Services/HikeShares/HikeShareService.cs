// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Telemetry;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels.HikeShare;

namespace Core.Services.HikeShares;

public class HikeShareService : IHikeShareService
{
    private readonly IHikeShareRepository _hikeShareRepository;
    private readonly IUserRepository _userRepository;
    private readonly IHikeRepository _hikeRepository;
    private readonly HikeShareDistributor _distributor;
    private readonly HikeResponseFactory _hikeResponseFactory;
    private readonly StigviddMetrics _metrics;
    private readonly ILogger _logger;

    public HikeShareService(
        IHikeShareRepository hikeShareRepository,
        IUserRepository userRepository,
        IHikeRepository hikeRepository,
        HikeShareDistributor distributor,
        HikeResponseFactory hikeResponseFactory,
        StigviddMetrics metrics,
        ILogger<HikeShareService> logger)
    {
        _hikeShareRepository = hikeShareRepository;
        _userRepository = userRepository;
        _hikeRepository = hikeRepository;
        _distributor = distributor;
        _hikeResponseFactory = hikeResponseFactory;
        _metrics = metrics;
        _logger = logger;
    }

    public async Task<Result<int>> GetHikeShareCountAsync(string identifier, string hikeIdentifier, CancellationToken ctoken)
    {
        var result = await _hikeShareRepository.GetHikeShareCountAsync(identifier, hikeIdentifier, ctoken);

        if (!result.IsSuccess)
            return Result.Fail<int>(new Message(500, "Something went wrong when fetching hike share count."));

        return Result.Ok<int>(result.Value);
    }

    public async Task<Result<IReadOnlyCollection<OutgoingHikeShareResponse>>> GetOutgoingSharesAsync(string identifier, CancellationToken ctoken)
    {
        var senderResult = await _userRepository.GetUserByIdentifierAsync(identifier, u => new SenderProjection(u.Id, u.NickName), ctoken);
        if (!senderResult.IsSuccess || senderResult.Value is null)
        {
            if (senderResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail<IReadOnlyCollection<OutgoingHikeShareResponse>>(new Message(404, "User not found with the given identifier."));

            return Result.Fail<IReadOnlyCollection<OutgoingHikeShareResponse>>(new Message(500, "Something went wrong when fetching user ID."));
        }

        var result = await _hikeShareRepository.GetHikesSharedByUserAsync(senderResult.Value.Id, ctoken);
        if (!result.IsSuccess || result.Value is null)
            return Result.Fail<IReadOnlyCollection<OutgoingHikeShareResponse>>(new Message(500, "Something went wrong when fetching sent shares."));

        IReadOnlyCollection<OutgoingHikeShareResponse> shares = result.Value
            .Where(h => h.Recipients.Count > 0)
            .Select(h => new OutgoingHikeShareResponse
            {
                HikeIdentifier = h.HikeIdentifier,
                HikeName = h.HikeName,
                HikeLength = h.HikeLength,
                Duration = h.Duration,
                Coordinates = GeoPathSerializer.ToCoordinateJson(h.GeoPath),
                IsOwnHike = h.IsOwnHike,
                ImageUrl = h.ImageUrl is null ? null : _hikeResponseFactory.PresentableBaseUrl + h.ImageUrl,
                LastSharedAt = h.Recipients.Max(r => r.SharedAt),
                Recipients = h.Recipients
                    .OrderByDescending(r => r.SharedAt)
                    .ThenBy(r => r.NickName, StringComparer.OrdinalIgnoreCase)
                    .Select(r => new OutgoingHikeShareRecipientResponse { Identifier = r.Identifier, NickName = r.NickName, SharedAt = r.SharedAt })
                    .ToList(),
            })
            .OrderByDescending(h => h.LastSharedAt)
            .ToList();

        return Result.Ok(shares);
    }

    public async Task<Result> ShareHikeAsync(string identifier, string hikeIdentifier, IReadOnlyCollection<string> sharedWithNames, bool allowResharing, CancellationToken ctoken)
    {
        var result = await ShareHikeCoreAsync(identifier, hikeIdentifier, sharedWithNames, allowResharing, ctoken);

        _metrics.RecordHikeShare(MetricTags.Values.KindShare, MetricOutcome.From(result));
        if (result.Success)
            _metrics.RecordHikeShareRecipients(MetricTags.Values.KindShare, result.Value);

        return result;
    }

    private async Task<Result<int>> ShareHikeCoreAsync(string identifier, string hikeIdentifier, IReadOnlyCollection<string> sharedWithNames, bool allowResharing, CancellationToken ctoken)
    {
        try
        {
            var senderResult = await _userRepository.GetUserByIdentifierAsync(identifier, u => new SenderProjection(u.Id, u.NickName), ctoken);
            if (!senderResult.IsSuccess || senderResult.Value is null)
            {
                if (senderResult.Status == RepositoryResultStatus.NotFound)
                    return Result.Fail<int>(new Message(404, "User not found with the given identifier."));

                return Result.Fail<int>(new Message(500, "Something went wrong when fetching user ID."));
            }

            var hikeResult = await _hikeRepository.GetHikeByIdentifierAsync(hikeIdentifier, ctoken);
            if (!hikeResult.IsSuccess || hikeResult.Value is null)
            {
                if (hikeResult.Status == RepositoryResultStatus.NotFound)
                    return Result.Fail<int>(new Message(404, "Hike not found with the given identifier."));

                return Result.Fail<int>(new Message(500, "Something went wrong when fetching hike."));
            }

            // keep-comment: checked before any name is looked up, so a non-owner learns nothing about the names
            if (hikeResult.Value.CreatedBy != identifier)
                return Result.Fail<int>(new Message(403, "You do not have permission to share this hike."));

            return await _distributor.DistributeAsync(
                senderResult.Value.Id, senderResult.Value.NickName, hikeResult.Value, sharedWithNames, allowResharing, ctoken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An unexpected error occurred while sharing the hike.");
            return Result.Fail<int>(new Message(500, "An unexpected error occurred while sharing the hike."));
        }
    }
}
