using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using NetTopologySuite.Geometries;
using WebDataContracts.RequestModels.Hike;
using WebDataContracts.ResponseModels.Hike;

namespace Core.Services;

public class HikeService : IHikeService
{
    private readonly HikeResponseFactory _hikeResponseFactory;
    private readonly IUserRepository _userRepository;
    private readonly IHikeRepository _hikeRepository;

    public HikeService(IHikeRepository hikeRepository,
        HikeResponseFactory hikeResponseFactory,
        IUserRepository userRepository)
    {
        _hikeRepository = hikeRepository;
        _hikeResponseFactory = hikeResponseFactory;
        _userRepository = userRepository;
    }

    public async Task<Result<HikeResponse>> CreateHikeAsync(CreateHikeRequest request, string userIdentifier, CancellationToken ctoken)
    {
        var userIdResult = await _userRepository.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

        if (!userIdResult.IsSuccess)
        {
            if (userIdResult.Status == RepositoryResultStatus.Error)
                return Result.Fail<HikeResponse>(new Message(500, "An error occurred while fetching the user."));

            return Result.Fail<HikeResponse>(new Message(404, "User not found"));
        }

        if (string.IsNullOrWhiteSpace(request.Name) ||
            request.Name.Length > 40 ||
            request.HikeLength == 0 ||
            request.Duration == 0)
        {
            return Result.Fail<HikeResponse>(new Message(400, "Hike properties are invalid."));
        }

        //parse json coordinates to NetTopologySuite.Geometries.Coordinate array
        var parsedCoordinates = Newtonsoft.Json.JsonConvert.DeserializeObject<WebDataContracts.Coordinate[]>(request.Coordinates);
        if(parsedCoordinates is null || parsedCoordinates.Length < 2)
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
            UserId = userIdResult.Value,
            ParkingInfo = request?.ParkingInfo,
            GettingThere = request?.GettingThere,
            Description = request?.Description
        };

        var result = await _hikeRepository.CreateHikeAsync(hike, ctoken);

        if (!result.IsSuccess)
            return Result.Fail<HikeResponse>(new Message(500, "An error occurred while adding the hike."));

        return Result.Ok(_hikeResponseFactory.Create(result.Value));
    }

    public async Task<Result<HikeResponse>> GetHikeByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _hikeRepository.GetHikeByIdentifierAsync(identifier, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<HikeResponse>(new Message(500, "An error occurred while fetching the hike."));

        if (!result.IsSuccess)
            return Result.Fail<HikeResponse>(new Message(404, "Hike not found"));

        return Result.Ok(_hikeResponseFactory.Create(result.Value));
    }

    public async Task<Result<IReadOnlyCollection<HikeOverviewResponse>>> GetHikesAsync(string? createdBy, CancellationToken ctoken)
    {
        int? userId = null;

        if (createdBy is not null)
        {
            var userIdResult = await _userRepository.GetUserIdByIdentifierAsync(createdBy, ctoken);

            if (!userIdResult.IsSuccess)
            {
                if (userIdResult.Status == RepositoryResultStatus.NotFound)
                {
                    return Result.Ok<IReadOnlyCollection<HikeOverviewResponse>>([]);
                }
                return Result.Fail<IReadOnlyCollection<HikeOverviewResponse>>(new Message(500, "An error occurred while fetching the user."));
            }

            userId = userIdResult.Value;
        }

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
                h.CreatedBy,
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
        string? parkingInfo, CancellationToken ctoken)
    {
        var userIdResult = await _userRepository.GetUserByIdentifierAsync(userIdentifier, u => u.Id, ctoken);

        if (!userIdResult.IsSuccess)
            return Result.Fail<HikeResponse>(new Message(404, "User not found"));

        var hikeResult = await _hikeRepository.GetHikeByIdentifierAsync(hikeIdentifier, ctoken);

        if (!hikeResult.IsSuccess)
        {
            if (hikeResult.Status == RepositoryResultStatus.Error)
                return Result.Fail<HikeResponse>(new Message(500, "An error occurred while fetching the hike."));

            if (hikeResult.Status == RepositoryResultStatus.NotFound || hikeResult.Value is null)
                return Result.Fail<HikeResponse>(new Message(404, "Hike not found"));
        }

        if (hikeResult.Value.UserId != userIdResult.Value)
            return Result.Fail<HikeResponse>(new Message(401, "Hike does not belong to the user"));


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

    public async Task<Result> SoftDeleteHikeAsync(string hikeIdentifier, string userIdentifier, CancellationToken ctoken)
    {
        var userResult = await _userRepository.GetUserByIdentifierAsync(userIdentifier, u => u, ctoken);

        if (!userResult.IsSuccess || userResult.Value is null)
            return Result.Fail<HikeResponse>(new Message(404, "User not found"));

        var result = await _hikeRepository.GetHikeByIdentifierAsync(hikeIdentifier, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while deleting the hike."));

        if (!result.IsSuccess)
            return Result.Fail(new Message(404, $"Could not remove hike with id {hikeIdentifier}."));

        if (result.Value.UserId != userResult.Value.Id)
            return Result.Fail(new Message(401, $"Hike {hikeIdentifier} does not belong to {userResult.Value.Id}"));

        await _hikeRepository.SoftDeleteHikeAsync(result.Value, ctoken);

        return Result.Ok();
    }

    public async Task<Result> DeleteHikeSharesByUserIdAsync(int userId, CancellationToken ctoken)
    {
        var result = await _hikeRepository.DeleteHikeSharesByUserIdAsync(userId, ctoken);

        if (!result.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while deleting the hike shares."));

        return Result.Ok();
    }

    public async Task<Result> DeleteHikesByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken)
    {
        var userResult = await _userRepository.GetUserByIdentifierAsync(userIdentifier, u => u, ctoken);

        if (!userResult.IsSuccess || userResult.Value is null)
            return Result.Fail<HikeResponse>(new Message(404, "User not found"));

        var result = await _hikeRepository.DeleteHikesByUserIdentifierAsync(userResult.Value.Identifier, ctoken);

        if (!result.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while deleting the hikes."));

        return Result.Ok();
    }

    public async Task<Result> HandleUserHikesOnUserDeleteAsync(int userId, CancellationToken ctoken)
    {
        var result = await _hikeRepository.HandleUserHikesOnUserDeleteAsync(userId, ctoken);

        if (!result.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while handling user hikes on user delete."));

        return Result.Ok();
    }
}
