// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Telemetry;
using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.HikeShare;

namespace Core.Services;

public class HikeShareRecipientService : IHikeShareRecipientService
{
    private readonly IHikeShareRecipientRepository _hikeShareRecipientRepository;
    private readonly IUserRepository _userRepository;
    private readonly IHikeRepository _hikeRepository;
    private readonly IUserBlockService _userBlockService;
    private readonly HikeShareDistributor _distributor;
    private readonly StigviddMetrics _metrics;
    // Dropping a share can leave a hike with no owner and no recipients. Cleaning that up owns
    // image files as well as rows, which is HikeService's job, so it is delegated rather than
    // repeated here.
    private readonly IHikeService _hikeService;
    private readonly HikeResponseFactory _hikeResponseFactory;

    public HikeShareRecipientService(
        IHikeShareRecipientRepository hikeShareRecipientRepository,
        IUserRepository userRepository,
        IHikeRepository hikeRepository,
        IUserBlockService userBlockService,
        HikeShareDistributor distributor,
        StigviddMetrics metrics,
        IHikeService hikeService,
        HikeResponseFactory hikeResponseFactory)
    {
        _hikeShareRecipientRepository = hikeShareRecipientRepository;
        _userRepository = userRepository;
        _hikeRepository = hikeRepository;
        _userBlockService = userBlockService;
        _distributor = distributor;
        _metrics = metrics;
        _hikeService = hikeService;
        _hikeResponseFactory = hikeResponseFactory;
    }

    public async Task<Result<IReadOnlyCollection<HikeShareRecipientResponse>>> GetAllHikesSharedWithUserAsync(string identifier, CancellationToken ctoken)
    {
        var hiddenUserIds = await _userBlockService.GetHiddenUserIdsForReadAsync(identifier, ctoken);
        var baseUrl = _hikeResponseFactory.PresentableBaseUrl;

        var result = await _hikeShareRecipientRepository.GetAllHikesSharedWithUserAsync(identifier, hiddenUserIds, hs => new HikeShareRecipientResponse
        {
            HikeIdentifier = hs.Hike!.Identifier,
            HikeName = hs.Hike.Name,
            Duration = hs.Hike.Duration,
            HikeLength = hs.Hike.HikeLength,
            Coordinates = GeoPathSerializer.ToCoordinateJson(hs.Hike.GeoPath),
            SharedByName = hs.SharedBy!.NickName,
            SharedByIdentifier = hs.SharedBy.Identifier,
            CreatedByName = hs.Hike.CreatedByNickName,
            SharedAt = hs.CreatedAt,
            GettingThere = hs.Hike.GettingThere,
            ParkingInfo = hs.Hike.ParkingInfo,
            Description = hs.Hike.Description,
            AllowResharing = hs.AllowResharing,
            Images = HikeResponseFactory.CreateImages(baseUrl, hs.Hike.Images)
        }, ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<HikeShareRecipientResponse>>(new Message(500, "Something went wrong while fetching shared hikes"));

        return Result.Ok(result.Value);
    }

    public async Task<Result> ReshareSharedHikeAsync(string hikeIdentifier, string userIdentifier, IReadOnlyCollection<string> reShareToNames, CancellationToken ctoken)
    {
        var result = await ReshareSharedHikeCoreAsync(hikeIdentifier, userIdentifier, reShareToNames, ctoken);

        _metrics.RecordHikeShare(MetricTags.Values.KindReshare, MetricOutcome.From(result));
        if (result.Success)
            _metrics.RecordHikeShareRecipients(MetricTags.Values.KindReshare, result.Value);

        return result;
    }

    private async Task<Result<int>> ReshareSharedHikeCoreAsync(string hikeIdentifier, string userIdentifier, IReadOnlyCollection<string> reShareToNames, CancellationToken ctoken)
    {
        var senderResult = await _userRepository.GetUserByIdentifierAsync(userIdentifier, u => new SenderProjection(u.Id, u.NickName), ctoken);
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

        // Must have it shared with them, accepted, and with the owner's permission to pass
        // it on. HikeShare is keyed on (HikeId, SharedWithId), so there is at most one row
        // per recipient and hike — a true here means that one row is accepted and allows it.
        var isAllowedToReshare = await _hikeShareRecipientRepository.IsAllowedToReshareHikeAsync(senderResult.Value.Id, hikeResult.Value.Id, ctoken);
        if (!isAllowedToReshare.IsSuccess)
            return Result.Fail<int>(new Message(500, "Something went wrong when checking reshare permissions."));

        if (!isAllowedToReshare.Value)
            return Result.Fail<int>(new Message(403, "You do not have permission to reshare this hike."));

        return await _distributor.DistributeAsync(
            senderResult.Value.Id, senderResult.Value.NickName, hikeResult.Value, reShareToNames, allowResharing: false, ctoken);
    }

    public async Task<Result> RemoveSharedHikeAsync(string hikeIdentifier, string userIdentifier, CancellationToken ctoken)
    {
        var userIdResult = await _userRepository.GetUserIdByIdentifierAsync(userIdentifier, ctoken);
        if (!userIdResult.IsSuccess)
        {
            if (userIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "User not found with the given identifier."));

            return Result.Fail(new Message(500, "Something went wrong when fetching user ID."));
        }

        var hikeIdResult = await _hikeRepository.GetHikeIdByIdentifierAsync(hikeIdentifier, ctoken);
        if (!hikeIdResult.IsSuccess)
        {
            if (hikeIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "Hike not found with the given identifier."));

            return Result.Fail(new Message(500, "Something went wrong when fetching hike."));
        }

        var result = await _hikeShareRecipientRepository.DeleteHikeShareAsync(hikeIdResult.Value, userIdResult.Value, ctoken);

        if (!result.IsSuccess)
            return Result.Fail(new Message(500, "Something went wrong while removing the shared hike."));

        // This may have been the last recipient of an ownerless hike
        await _hikeService.CleanUpOrphanedHikesAsync(ctoken);

        return Result.Ok();
    }

    public async Task<Result<IReadOnlyCollection<IncomingHikeShareResponse>>> GetIncomingPendingSharesAsync(string identifier, CancellationToken ctoken)
    {
        var userIdResult = await _userRepository.GetUserIdByIdentifierAsync(identifier, ctoken);
        if (!userIdResult.IsSuccess)
        {
            if (userIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail<IReadOnlyCollection<IncomingHikeShareResponse>>(new Message(404, "User not found with the given identifier."));

            return Result.Fail<IReadOnlyCollection<IncomingHikeShareResponse>>(new Message(500, "Something went wrong when fetching user ID."));
        }

        var hiddenUserIds = await _userBlockService.GetHiddenUserIdsForReadAsync(identifier, ctoken);

        var pendingSharesResult = await _hikeShareRecipientRepository.GetPendingSharesForUserAsync(userIdResult.Value,
            hiddenUserIds,
            hs => IncomingHikeShareResponse.Create(
                hs.Hike!.Identifier,
                hs.Hike.Name,
                hs.Hike.HikeLength,
                hs.Hike.Duration,
                hs.SharedBy!.NickName,
                hs.SharedBy.Identifier,
                hs.Hike.CreatedByNickName,
                hs.CreatedAt),
            ctoken);

        if (!pendingSharesResult.IsSuccess)
            return Result.Fail<IReadOnlyCollection<IncomingHikeShareResponse>>(new Message(500, "Something went wrong when fetching pending shares."));

        return Result.Ok(pendingSharesResult.Value);
    }

    public async Task<Result<HikeShareRecipientResponse>> GetIncomingPendingShareAsync(string userIdentifier, string hikeIdentifier, CancellationToken ctoken)
    {
        var userIdResult = await _userRepository.GetUserIdByIdentifierAsync(userIdentifier, ctoken);
        if (!userIdResult.IsSuccess)
        {
            if (userIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail<HikeShareRecipientResponse>(new Message(404, "User not found with the given identifier."));

            return Result.Fail<HikeShareRecipientResponse>(new Message(500, "Something went wrong when fetching user ID."));
        }

        var hiddenUserIds = await _userBlockService.GetHiddenUserIdsForReadAsync(userIdentifier, ctoken);
        var baseUrl = _hikeResponseFactory.PresentableBaseUrl;

        var result = await _hikeShareRecipientRepository.GetPendingShareByIdentifierAsync(userIdResult.Value, hikeIdentifier, hiddenUserIds, hs => HikeShareRecipientResponse.Create(
            hs.Hike!.Identifier,
            hs.Hike.Name,
            hs.Hike.HikeLength,
            hs.Hike.Duration,
            GeoPathSerializer.ToCoordinateJson(hs.Hike.GeoPath),
            hs.Hike.CreatedByNickName,
            hs.SharedBy!.NickName,
            hs.SharedBy.Identifier,
            hs.CreatedAt,
            hs.Hike.GettingThere,
            hs.Hike.ParkingInfo,
            hs.Hike.Description,
            hs.AllowResharing,
            HikeResponseFactory.CreateImages(baseUrl, hs.Hike.Images)), ctoken);

        if (!result.IsSuccess)
        {
            if (result.Status == RepositoryResultStatus.NotFound)
                return Result.Fail<HikeShareRecipientResponse>(new Message(404, "Pending share not found."));

            return Result.Fail<HikeShareRecipientResponse>(new Message(500, "Something went wrong while fetching the pending share."));
        }

        return Result.Ok(result.Value);
    }

    public async Task<Result> AcceptHikeShareAsync(string userIdentifier, string hikeIdentifier, CancellationToken ctoken)
    {
        var userIdResult = await _userRepository.GetUserIdByIdentifierAsync(userIdentifier, ctoken);
        if (!userIdResult.IsSuccess)
        {
            if (userIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "User not found with the given identifier."));

            return Result.Fail(new Message(500, "Something went wrong when fetching user ID."));
        }

        var hikeIdResult = await _hikeRepository.GetHikeIdByIdentifierAsync(hikeIdentifier, ctoken);
        if (!hikeIdResult.IsSuccess)
        {
            if (hikeIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "Hike not found with the given identifier."));

            return Result.Fail(new Message(500, "Something went wrong when fetching hike."));
        }

        var result = await _hikeShareRecipientRepository.AcceptHikeShareAsync(hikeIdResult.Value, userIdResult.Value, ctoken);
        if (!result.IsSuccess)
        {
            if (result.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "Pending share not found."));

            return Result.Fail(new Message(500, "Something went wrong while accepting the hike share."));
        }

        return Result.Ok();
    }

    public async Task<Result> RejectHikeShareAsync(string userIdentifier, string hikeIdentifier, CancellationToken ctoken)
    {
        var userIdResult = await _userRepository.GetUserIdByIdentifierAsync(userIdentifier, ctoken);
        if (!userIdResult.IsSuccess)
        {
            if (userIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "User not found with the given identifier."));

            return Result.Fail(new Message(500, "Something went wrong when fetching user ID."));
        }

        var hikeIdResult = await _hikeRepository.GetHikeIdByIdentifierAsync(hikeIdentifier, ctoken);
        if (!hikeIdResult.IsSuccess)
        {
            if (hikeIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "Hike not found with the given identifier."));

            return Result.Fail(new Message(500, "Something went wrong when fetching hike."));
        }

        var result = await _hikeShareRecipientRepository.RejectHikeShareAsync(hikeIdResult.Value, userIdResult.Value, ctoken);
        if (!result.IsSuccess)
        {
            if (result.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "Hike share not found."));

            return Result.Fail(new Message(500, "An error occurred while rejecting the hike share."));
        }

        // A rejected share can have been the last one holding an ownerless hike alive
        await _hikeService.CleanUpOrphanedHikesAsync(ctoken);

        return Result.Ok();
    }
}
