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

    public HikeShareRecipientService(
        IHikeShareRecipientRepository hikeShareRecipientRepository,
        IUserRepository userRepository,
        IHikeRepository hikeRepository,
        IFriendRepository friendRepository)
    {
        _hikeShareRecipientRepository = hikeShareRecipientRepository;
        _userRepository = userRepository;
        _hikeRepository = hikeRepository;
        _friendRepository = friendRepository;
    }

    public async Task<Result<IReadOnlyCollection<HikeShareRecipientResponse>>> GetAllHikesSharedWithUserAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _hikeShareRecipientRepository.GetAllHikesSharedWithUserAsync(identifier, hs => new HikeShareRecipientResponse
        {
            HikeIdentifier = hs.Hike!.Identifier,
            HikeName = hs.Hike.Name,
            Duration = hs.Hike.Duration,
            HikeLength = hs.Hike.HikeLength,
            Coordinates = hs.Hike.Coordinates,
            SharedByName = hs.SharedBy!.NickName,
            SharedByIdentifier = hs.SharedBy.Identifier,
            CreatedByName = hs.Hike.User!.NickName,
            SharedAt = hs.CreatedAt,
            GettingThere = hs.Hike.GettingThere,
            ParkingInfo = hs.Hike.ParkingInfo,
            Description = hs.Hike.Description
        }, ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<HikeShareRecipientResponse>>(new Message(500, "Something went wrong while fetching shared hikes"));

        return Result.Ok(result.Value);
    }

    public async Task<Result> ReshareSharedHikeAsync(string hikeIdentifier, string userIdentifier, string reShareToName, CancellationToken ctoken)
    {
        var userIdResult = await _userRepository.GetUserIdByIdentifierAsync(userIdentifier, ctoken);
        if (!userIdResult.IsSuccess)
        {
            if (userIdResult.Status == RepositoryResultStatus.NotFound)
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

        // Must have it shared with them to be able to reshare it
        var hasRighToShare = await _hikeShareRecipientRepository.HasHikeSharedWithUserAsync(userIdResult.Value, hikeResult.Value.Id, ctoken);
        if (!hasRighToShare.IsSuccess)
            return Result.Fail(new Message(500, "Something went wrong when checking share permissions."));

        if (!hasRighToShare.Value)
            return Result.Fail(new Message(403, "You do not have permission to reshare this hike."));

        var sharedWithUserIdResult = await _userRepository.GetUserIdByNameAsync(reShareToName, ctoken);
        if (!sharedWithUserIdResult.IsSuccess)
        {
            if (sharedWithUserIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "User not found with the given name."));

            return Result.Fail(new Message(500, "Something went wrong when fetching user ID."));
        }

        // Must be friends to share a hike
        var areFriendsResult = await _friendRepository.FriendshipExistsAsync(userIdResult.Value, sharedWithUserIdResult.Value, ctoken);
        if (!areFriendsResult.IsSuccess)
            return Result.Fail(new Message(500, "Something went wrong when checking friendship status."));

        if (!areFriendsResult.Value)
            return Result.Fail(new Message(403, "You can only share a hike with a friend."));

        // Cannot share with yourself
        if (userIdResult.Value == sharedWithUserIdResult.Value)
            return Result.Fail(new Message(400, "You cannot share a hike with yourself."));

        // ReshareToUser can not be owner of the hike 
        var isOwner = hikeResult.Value.UserId == sharedWithUserIdResult.Value;
        if (isOwner)
            return Result.Fail(new Message(400, "You cannot reshare a hike to the owner."));

        // Already shared with user
        var alreadyShared = await _hikeShareRecipientRepository.HasHikeSharedWithUserAsync(sharedWithUserIdResult.Value, hikeResult.Value.Id, ctoken);
        if (!alreadyShared.IsSuccess)
            return Result.Fail(new Message(500, "Something went wrong when checking if hike is already shared."));

        if (alreadyShared.Value)
            return Result.Fail(new Message(409, "This hike has already been shared with this user."));

        var hikeShare = new HikeShare
        {
            HikeId = hikeResult.Value.Id,
            SharedById = userIdResult.Value,
            SharedWithId = sharedWithUserIdResult.Value,
            CreatedAt = DateTime.UtcNow
        };

        var result = await _hikeShareRecipientRepository.ReshareSharedHikeAsync(hikeShare, ctoken);
        if (!result.IsSuccess)
            return Result.Fail(new Message(500, "Something went wrong while resharing the hike"));

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

        return Result.Ok();
    }
}
