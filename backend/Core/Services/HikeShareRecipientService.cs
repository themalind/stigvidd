// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.HikeShare;

namespace Core.Services;

public class HikeShareRecipientService : IHikeShareRecipientService
{
    private readonly IHikeShareRecipientRepository _hikeShareRecipientRepository;
    private readonly IUserRepository _userRepository;
    private readonly IHikeRepository _hikeRepository;
    private readonly IFriendRepository _friendRepository;
    private readonly IPushNotificationService _pushNotificationService;
    // Dropping a share can leave a hike with no owner and no recipients. Cleaning that up owns
    // image files as well as rows, which is HikeService's job, so it is delegated rather than
    // repeated here.
    private readonly IHikeService _hikeService;

    public HikeShareRecipientService(
        IHikeShareRecipientRepository hikeShareRecipientRepository,
        IUserRepository userRepository,
        IHikeRepository hikeRepository,
        IFriendRepository friendRepository,
        IPushNotificationService pushNotificationService,
        IHikeService hikeService)
    {
        _hikeShareRecipientRepository = hikeShareRecipientRepository;
        _userRepository = userRepository;
        _hikeRepository = hikeRepository;
        _friendRepository = friendRepository;
        _pushNotificationService = pushNotificationService;
        _hikeService = hikeService;
    }

    public async Task<Result<IReadOnlyCollection<HikeShareRecipientResponse>>> GetAllHikesSharedWithUserAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _hikeShareRecipientRepository.GetAllHikesSharedWithUserAsync(identifier, hs => new HikeShareRecipientResponse
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
            AllowResharing = hs.AllowResharing
        }, ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<HikeShareRecipientResponse>>(new Message(500, "Something went wrong while fetching shared hikes"));

        return Result.Ok(result.Value);
    }

    public async Task<Result> ReshareSharedHikeAsync(string hikeIdentifier, string userIdentifier, string reShareToName, CancellationToken ctoken)
    {
        var senderResult = await _userRepository.GetUserByIdentifierAsync(userIdentifier, u => new SenderProjection(u.Id, u.NickName), ctoken);
        if (!senderResult.IsSuccess)
        {
            if (senderResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "User not found with the given identifier."));

            return Result.Fail(new Message(500, "Something went wrong when fetching user ID."));
        }

        var hikeResult = await _hikeRepository.GetHikeByIdentifierAsync(hikeIdentifier, ctoken);
        if (!hikeResult.IsSuccess)
        {
            if (hikeResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "Hike not found with the given identifier."));

            return Result.Fail(new Message(500, "Something went wrong when fetching hike."));
        }

        // Must have it shared with them, accepted, and with the owner's permission to pass
        // it on. HikeShare is keyed on (HikeId, SharedWithId), so there is at most one row
        // per recipient and hike — a true here means that one row is accepted and allows it.
        var isAllowedToReshare = await _hikeShareRecipientRepository.IsAllowedToReshareHikeAsync(senderResult.Value.Id, hikeResult.Value.Id, ctoken);
        if (!isAllowedToReshare.IsSuccess)
            return Result.Fail(new Message(500, "Something went wrong when checking reshare permissions."));

        if (!isAllowedToReshare.Value)
            return Result.Fail(new Message(403, "You do not have permission to reshare this hike."));

        var recipientResult = await _userRepository.GetUserByNickNameAsync(reShareToName, u => new ReceiverProjection(u.Id, u.Identifier), ctoken);
        if (!recipientResult.IsSuccess)
        {
            if (recipientResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "User not found with the given name."));

            return Result.Fail(new Message(500, "Something went wrong when fetching user ID."));
        }

        // Must be friends to share a hike
        var areFriendsResult = await _friendRepository.FriendshipExistsAsync(senderResult.Value.Id, recipientResult.Value.Id, ctoken);
        if (!areFriendsResult.IsSuccess)
            return Result.Fail(new Message(500, "Something went wrong when checking friendship status."));

        if (!areFriendsResult.Value)
            return Result.Fail(new Message(403, "You can only share a hike with a friend."));

        // Cannot share with yourself
        if (senderResult.Value.Id == recipientResult.Value.Id)
            return Result.Fail(new Message(400, "You cannot share a hike with yourself."));

        // ReshareToUser can not be owner of the hike
        var isOwner = hikeResult.Value.UserId == recipientResult.Value.Id;
        if (isOwner)
            return Result.Fail(new Message(400, "You cannot reshare a hike to the owner."));

        // Already shared with user (pending or accepted)
        var alreadyShared = await _hikeShareRecipientRepository.HasHikeSharedWithUserAsync(recipientResult.Value.Id, hikeResult.Value.Id, ctoken);
        if (!alreadyShared.IsSuccess)
            return Result.Fail(new Message(500, "Something went wrong when checking if hike is already shared."));

        if (alreadyShared.Value)
            return Result.Fail(new Message(409, "This hike has already been shared with this user."));

        var hikeShare = new HikeShare
        {
            HikeId = hikeResult.Value.Id,
            SharedById = senderResult.Value.Id,
            SharedWithId = recipientResult.Value.Id,
            CreatedAt = DateTime.UtcNow,
            AllowResharing = false
        };

        var result = await _hikeShareRecipientRepository.ReshareSharedHikeAsync(hikeShare, ctoken);
        if (!result.IsSuccess)
            return Result.Fail(new Message(500, "Something went wrong while resharing the hike"));

        // Send push notification to the recipient
        await _pushNotificationService.SendToUserAsync(
            recipientResult.Value.Identifier, "Ny delad vandring",
            $"{senderResult.Value.NickName} vill dela en vandring med dig",
             new Dictionary<string, object> { ["type"] = "hike_share" }, ctoken);

        return Result.Ok();
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

        var pendingSharesResult = await _hikeShareRecipientRepository.GetPendingSharesForUserAsync(userIdResult.Value,
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

        var result = await _hikeShareRecipientRepository.GetPendingShareByIdentifierAsync(userIdResult.Value, hikeIdentifier, hs => HikeShareRecipientResponse.Create(
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
            hs.AllowResharing), ctoken);

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

    internal record SenderProjection(int Id, string NickName);
    internal record ReceiverProjection(int Id, string Identifier);
}
