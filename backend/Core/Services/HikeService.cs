using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;
using System.Runtime.CompilerServices;
using WebDataContracts.RequestModels.Hike;
using WebDataContracts.ResponseModels.Hike;

namespace Core.Services;

public class HikeService : IHikeService
{
    // Upper bound on recorded points per hike. The app caps a recording at 12 h and
    // samples every ~3 s (~14,400 points); this leaves generous headroom while
    // rejecting oversized payloads. Mirror the raw-string cap in CreateHikeRequestValidator.
    private const int MaxCoordinates = 20_000;

    private readonly HikeResponseFactory _hikeResponseFactory;
    private readonly IUserRepository _userRepository;
    private readonly IHikeRepository _hikeRepository;
    private readonly IHikeShareRecipientRepository _hikeShareRecipientRepository;
    private readonly IWebDavService _webDavService;
    private readonly ILogger<HikeService> _logger;

    public HikeService(IHikeRepository hikeRepository,
        HikeResponseFactory hikeResponseFactory,
        IUserRepository userRepository,
        IHikeShareRecipientRepository hikeShareRecipientRepository,
        IWebDavService webDavService,
        ILogger<HikeService> logger)
    {
        _hikeRepository = hikeRepository;
        _hikeResponseFactory = hikeResponseFactory;
        _userRepository = userRepository;
        _hikeShareRecipientRepository = hikeShareRecipientRepository;
        _webDavService = webDavService;
        _logger = logger;
    }

    public async Task<Result<HikeResponse>> CreateHikeAsync(CreateHikeRequest request, string userIdentifier, CancellationToken ctoken)
    {
        var userResult = await _userRepository.GetUserByIdentifierAsync(userIdentifier, u => new UserProjection(u.Id, u.NickName), ctoken);

        if (!userResult.IsSuccess)
        {
            if (userResult.Status == RepositoryResultStatus.Error)
                return Result.Fail<HikeResponse>(new Message(500, "An error occurred while fetching the user."));

            return Result.Fail<HikeResponse>(new Message(404, "User not found"));
        }

        // Name/HikeLength/Duration/Coordinates are validated by CreateHikeRequestValidator,
        // which SharpGrip auto-validation runs before this service is reached.

        // Parse the JSON coordinate blob into a NetTopologySuite Coordinate array.
        // A malformed blob is expected client input, so map the parse failure to a
        // 400 rather than letting it bubble up as an unhandled 500.
        WebDataContracts.Coordinate[]? parsedCoordinates;
        try
        {
            parsedCoordinates = Newtonsoft.Json.JsonConvert.DeserializeObject<WebDataContracts.Coordinate[]>(request.Coordinates);
        }
        catch (Newtonsoft.Json.JsonException)
        {
            return Result.Fail<HikeResponse>(new Message(400, "Hike coordinates are invalid."));
        }

        if (parsedCoordinates is null || parsedCoordinates.Length < 2 || parsedCoordinates.Length > MaxCoordinates)
        {
            return Result.Fail<HikeResponse>(new Message(400, "Hike coordinates are invalid."));
        }

        // Neither the geometry column nor NetTopologySuite enforces geographic ranges,
        // so guard here: any point outside WGS84 bounds (lat ±90, lng ±180) or non-finite
        // is a bad payload that would otherwise persist and corrupt the rendered route.
        if (parsedCoordinates.Any(c =>
                !double.IsFinite(c.Latitude) || !double.IsFinite(c.Longitude) ||
                c.Latitude < -90 || c.Latitude > 90 ||
                c.Longitude < -180 || c.Longitude > 180))
        {
            return Result.Fail<HikeResponse>(new Message(400, "Hike coordinates are invalid."));
        }

        var coords = new LineString([.. parsedCoordinates.Select(c => new NetTopologySuite.Geometries.Coordinate(c.Longitude, c.Latitude))]);

        var hike = new Hike
        {
            Name = request.Name,
            HikeLength = request.HikeLength / 1000,
            Duration = request.Duration,
            GeoPath = coords,
            CreatedBy = userIdentifier,
            UserId = userResult.Value.Id,
            ParkingInfo = request?.ParkingInfo,
            GettingThere = request?.GettingThere,
            Description = request?.Description,
            CreatedByNickName = userResult.Value.NickName
        };

        var result = await _hikeRepository.CreateHikeAsync(hike, ctoken);

        if (!result.IsSuccess)
            return Result.Fail<HikeResponse>(new Message(500, "An error occurred while adding the hike."));

        return Result.Ok(_hikeResponseFactory.Create(result.Value));
    }

    public async Task<Result<HikeResponse>> GetHikeByIdentifierAsync(string identifier, string userIdentifier, CancellationToken ctoken)
    {
        var result = await _hikeRepository.GetHikeByIdentifierAsync(identifier, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<HikeResponse>(new Message(500, "An error occurred while fetching the hike."));

        if (!result.IsSuccess)
            return Result.Fail<HikeResponse>(new Message(404, "Hike not found"));

        // Hikes are private: readable by the creator, or by a user the hike has been
        // shared with (pending or accepted). Everyone else is forbidden.
        if (result.Value.CreatedBy != userIdentifier)
        {
            var userIdResult = await _userRepository.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

            if (userIdResult.Status == RepositoryResultStatus.Error)
                return Result.Fail<HikeResponse>(new Message(500, "An error occurred while fetching the hike."));

            // No user row: authenticated, but unknown here, so no share can point at them.
            if (!userIdResult.IsSuccess)
                return Result.Fail<HikeResponse>(new Message(403, "Hike does not belong to the user"));

            var shareResult = await _hikeShareRecipientRepository.HasHikeSharedWithUserAsync(userIdResult.Value, result.Value.Id, ctoken);

            // Success or Error only — this one never reports NotFound.
            if (!shareResult.IsSuccess)
                return Result.Fail<HikeResponse>(new Message(500, "An error occurred while fetching the hike."));

            if (!shareResult.Value)
                return Result.Fail<HikeResponse>(new Message(403, "Hike does not belong to the user"));
        }

        return Result.Ok(_hikeResponseFactory.Create(result.Value));
    }

    public async Task<Result<IReadOnlyCollection<HikeOverviewResponse>>> GetHikesAsync(string createdBy, CancellationToken ctoken)
    {
        var userIdResult = await _userRepository.GetUserIdByIdentifierAsync(createdBy, ctoken);

        if (userIdResult.Status == RepositoryResultStatus.Error)
            return Result.Fail<IReadOnlyCollection<HikeOverviewResponse>>(new Message(500, "An error occurred while fetching the user."));

        if (!userIdResult.IsSuccess)
            return Result.Fail<IReadOnlyCollection<HikeOverviewResponse>>(new Message(404, "User not found"));

        int userId = userIdResult.Value;

        // GeoPathSerializer runs in the top-level projection, which EF Core evaluates
        // client-side after materializing the geometry column.
        var result = await _hikeRepository.GetHikesAsync(
            userId,
            h => HikeOverviewResponse.Create(
                h.Identifier,
                h.Name,
                h.HikeLength,
                h.Duration,
                GeoPathSerializer.ToCoordinateJson(h.GeoPath),
                h.CreatedBy ?? string.Empty,
                h.GettingThere,
                h.ParkingInfo,
                h.Description,
                h.CreatedAt),
            ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<HikeOverviewResponse>>(new Message(500, "An error occurred while fetching hikes."));

        return Result.Ok(result.Value);
    }

    public async Task<Result<HikeResponse>> UpdateHikeAsync(
        string hikeIdentifier,
        string userIdentifier,
        string? name,
        string? description,
        string? gettingThere,
        string? parkingInfo,
        CancellationToken ctoken)
    {
        var userIdResult = await _userRepository.GetUserByIdentifierAsync(userIdentifier, u => u.Id, ctoken);

        if (userIdResult.Status == RepositoryResultStatus.Error)
            return Result.Fail<HikeResponse>(new Message(500, "An error occurred while fetching the user."));

        if (!userIdResult.IsSuccess)
            return Result.Fail<HikeResponse>(new Message(404, "User not found"));

        var hikeResult = await _hikeRepository.GetHikeByIdentifierAsync(hikeIdentifier, ctoken);

        if (hikeResult.Status == RepositoryResultStatus.Error)
            return Result.Fail<HikeResponse>(new Message(500, "An error occurred while fetching the hike."));

        // Any other unsuccessful status ends here too: falling through would dereference Value.
        if (!hikeResult.IsSuccess || hikeResult.Value is null)
            return Result.Fail<HikeResponse>(new Message(404, "Hike not found"));

        if (hikeResult.Value.UserId != userIdResult.Value)
            return Result.Fail<HikeResponse>(new Message(403, "Hike does not belong to the user"));


        if (!string.IsNullOrEmpty(name))
        {
            hikeResult.Value.Name = name;
        }

        if (!string.IsNullOrEmpty(description))
        {
            hikeResult.Value.Description = description;
        }

        if (!string.IsNullOrEmpty(gettingThere))
        {
            hikeResult.Value.GettingThere = gettingThere;
        }

        if (!string.IsNullOrEmpty(parkingInfo))
        {
            hikeResult.Value.ParkingInfo = parkingInfo;
        }

        await _hikeRepository.UpdateHikeAsync(hikeResult.Value, ctoken);

        return Result.Ok(_hikeResponseFactory.Create(hikeResult.Value));
    }

    public async Task<Result> DeleteHikeAsync(string hikeIdentifier, string userIdentifier, CancellationToken ctoken)
    {
        var userResult = await _userRepository.GetUserByIdentifierAsync(userIdentifier, u => u, ctoken);

        if (userResult.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while deleting the hike."));

        if (!userResult.IsSuccess || userResult.Value is null)
            return Result.Fail<HikeResponse>(new Message(404, "User not found"));

        var result = await _hikeRepository.GetHikeByIdentifierAsync(hikeIdentifier, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while deleting the hike."));

        if (!result.IsSuccess)
            return Result.Fail(new Message(404, $"Could not remove hike with id {hikeIdentifier}."));

        if (result.Value.UserId != userResult.Value.Id)
            return Result.Fail(new Message(403, $"Hike {hikeIdentifier} does not belong to {userResult.Value.Id}"));

        var isSharedResult = await _hikeRepository.HikeHasSharesAsync(result.Value.Id, ctoken);

        if (!isSharedResult.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while deleting the hike."));

        // A shared hike is not removed, only detached from its owner: it stays with the
        // recipients, images and all, so there is nothing to collect and nothing to delete.
        IEnumerable<string> imageUrls = [];

        if (!isSharedResult.Value)
        {
            var imageUrlsResult = await _hikeRepository.GetHikeImageUrlsByHikeIdAsync(result.Value.Id, ctoken);

            if (!imageUrlsResult.IsSuccess)
                return Result.Fail(new Message(500, "An error occurred while fetching the hike image URLs."));

            imageUrls = imageUrlsResult.Value;
        }

        var deleteResult = await _hikeRepository.DeleteHikeAsync(result.Value, ctoken);

        if (!deleteResult.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while deleting the hike."));

        await DeleteImageFilesAsync(imageUrls, $"HikeIdentifier: {hikeIdentifier}, UserIdentifier: {userIdentifier}");

        return Result.Ok();
    }

    public async Task<Result> DeleteHikeSharesByUserIdAsync(int userId, CancellationToken ctoken)
    {
        var result = await _hikeRepository.DeleteHikeSharesByUserIdAsync(userId, ctoken);

        if (!result.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while deleting the hike shares."));

        await CleanUpOrphanedHikesAsync(ctoken);

        return Result.Ok();
    }

    // Call after any path that removes HikeShare rows. A hike that has lost both its owner and
    // its last recipient is kept for nobody, so it is removed here together with its image files.
    //
    // Housekeeping, not part of what the caller asked for: the share is already gone and their
    // request succeeded, so a failed sweep is logged and leaves a row behind for the next sweep
    // to catch rather than reporting an error for something the caller neither did nor can fix.
    public async Task CleanUpOrphanedHikesAsync(CancellationToken ctoken)
    {
        var imageUrlsResult = await _hikeRepository.GetOrphanedHikeImageUrlsAsync(ctoken);

        if (!imageUrlsResult.IsSuccess)
        {
            _logger.LogWarning("HikeService: CleanUpOrphanedHikesAsync -> Could not read the image URLs of orphaned hikes; leaving them for the next sweep.");
            return;
        }

        var result = await _hikeRepository.DeleteOrphanedHikesAsync(ctoken);

        if (!result.IsSuccess)
        {
            _logger.LogWarning("HikeService: CleanUpOrphanedHikesAsync -> Could not delete orphaned hikes; leaving them for the next sweep.");
            return;
        }

        await DeleteImageFilesAsync(imageUrlsResult.Value, "Orphaned hike cleanup: no owner and no shares left.");
    }

    public async Task<Result> HandleUserHikesOnUserDeleteAsync(int userId, CancellationToken ctoken)
    {
        // Read the URLs first: only the hikes that are actually removed (the ones without
        // shares) should lose their files, and once the rows are gone so are the URLs.
        var imageUrlsResult = await _hikeRepository.GetDeletableHikeImageUrlsByUserIdAsync(userId, ctoken);

        if (!imageUrlsResult.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while fetching the hike image URLs."));

        // Delete Hikes with no shares
        var result = await _hikeRepository.HandleUserHikesOnUserDeleteAsync(userId, ctoken);

        if (!result.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while handling user hikes on user delete."));

        // Whatever is still owned by this user is a shared hike, kept for its recipients.
        // It survives the account, but the creator's identifiers must not survive with it.
        var anonymizeResult = await _hikeRepository.AnonymizeSharedHikesOnUserDeleteAsync(userId, ctoken);

        if (!anonymizeResult.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while anonymizing the shared hikes."));

        // Files go after the rows: an orphaned file can be cleaned up later, a row pointing at
        // a missing file cannot be undone. A WebDAV failure must not fail the account deletion.
        await DeleteImageFilesAsync(imageUrlsResult.Value, $"Account deletion. UserId: {userId}");

        return Result.Ok();
    }

    // Best-effort file removal: a leftover file is recoverable, so a WebDAV failure is logged
    // rather than surfaced. A leftover file is only findable again through the log line, so the
    // caller passes the identifiers that make it traceable; the calling method's name comes along
    // on its own.
    private async Task DeleteImageFilesAsync(
        IEnumerable<string> urls,
        string context,
        [CallerMemberName] string operation = "")
    {
        foreach (var url in urls)
        {
            try
            {
                var result = await _webDavService.DeleteFileAsync(url);

                // WebDAV answered, but refused: no exception to catch, so it is reported here
                if (result.IsFailure)
                    _logger.LogError("{Operation}: WebDAV refused to delete hike image {Url}. {Context}", operation, url, context);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "{Operation}: Failed to delete hike image {Url}. {Context}", operation, url, context);
            }
        }
    }
}

internal record UserProjection(int Id, string NickName);