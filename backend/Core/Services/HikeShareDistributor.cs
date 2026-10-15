// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging;

namespace Core.Services;

// Shares one hike with a list of friends, for both the owner's share and a recipient's reshare.
// The caller has already checked that the sender may share this hike.
public class HikeShareDistributor
{
    private readonly IUserRepository _userRepository;
    private readonly IFriendRepository _friendRepository;
    private readonly IHikeShareRepository _hikeShareRepository;
    private readonly IPushNotificationService _pushNotificationService;
    private readonly ILogger<HikeShareDistributor> _logger;

    public HikeShareDistributor(
        IUserRepository userRepository,
        IFriendRepository friendRepository,
        IHikeShareRepository hikeShareRepository,
        IPushNotificationService pushNotificationService,
        ILogger<HikeShareDistributor> logger)
    {
        _userRepository = userRepository;
        _friendRepository = friendRepository;
        _hikeShareRepository = hikeShareRepository;
        _pushNotificationService = pushNotificationService;
        _logger = logger;
    }

    /// <summary>Returns how many recipients were new. All-or-nothing: one bad name shares with nobody.</summary>
    public async Task<Result<int>> DistributeAsync(int senderId, string senderNickName, Hike hike, IReadOnlyCollection<string> names, bool allowResharing, CancellationToken ctoken)
    {
        var recipients = new List<ReceiverProjection>();

        foreach (var name in names)
        {
            var recipientResult = await _userRepository.GetUserByNickNameAsync(name, u => new ReceiverProjection(u.Id, u.Identifier), ctoken);

            if (recipientResult.Status == RepositoryResultStatus.Error)
                return Result.Fail<int>(new Message(500, "Something went wrong when fetching the recipient."));

            if (!recipientResult.IsSuccess || recipientResult.Value is null)
                return Result.Fail<int>(RecipientNotFound());

            if (recipientResult.Value.Id == senderId)
                return Result.Fail<int>(new Message(400, "You cannot share a hike with yourself."));

            var areFriendsResult = await _friendRepository.FriendshipExistsAsync(senderId, recipientResult.Value.Id, ctoken);

            if (!areFriendsResult.IsSuccess)
                return Result.Fail<int>(new Message(500, "Something went wrong when checking friendship status."));

            // keep-comment: same answer as an unknown name, so a share request cannot probe which nicknames exist
            if (!areFriendsResult.Value)
                return Result.Fail<int>(RecipientNotFound());

            if (recipients.All(r => r.Id != recipientResult.Value.Id))
                recipients.Add(recipientResult.Value);
        }

        // keep-comment: the owner and anyone who already has the hike are skipped silently, so the answer never tells who had it
        var newRecipients = new List<ReceiverProjection>();

        foreach (var recipient in recipients)
        {
            if (hike.UserId == recipient.Id)
                continue;

            var alreadySharedResult = await _hikeShareRepository.IsAlreadySharedAsync(hike.Id, recipient.Id, ctoken);

            if (!alreadySharedResult.IsSuccess)
                return Result.Fail<int>(new Message(500, "Something went wrong when checking if the hike is already shared."));

            if (!alreadySharedResult.Value)
                newRecipients.Add(recipient);
        }

        _logger.LogInformation(
            "HikeShareDistributor: hike {HikeId} requested for {Requested} recipients, {New} new, {AlreadyHad} skipped",
            hike.Id, recipients.Count, newRecipients.Count, recipients.Count - newRecipients.Count);

        if (newRecipients.Count == 0)
            return Result.Ok(0);

        var hikeShares = newRecipients.Select(r => new HikeShare
        {
            HikeId = hike.Id,
            SharedById = senderId,
            SharedWithId = r.Id,
            AllowResharing = allowResharing,
        }).ToList();

        var insertResult = await _hikeShareRepository.ShareHikesAsync(hikeShares, ctoken);

        if (!insertResult.IsSuccess)
            return Result.Fail<int>(new Message(500, "Something went wrong when sharing the hike."));

        await _pushNotificationService.SendToUsersAsync(
            newRecipients.Select(r => r.Id).ToList(), "Ny delad vandring",
            $"{senderNickName} vill dela en vandring med dig",
            new Dictionary<string, object> { ["type"] = "hike_share" }, ctoken,
            fromUserId: senderId);

        return Result.Ok(newRecipients.Count);
    }

    private static Message RecipientNotFound() => new(404, "Recipient not found among your friends.");
}
