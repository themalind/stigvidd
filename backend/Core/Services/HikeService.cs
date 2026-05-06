using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using WebDataContracts.RequestModels.Hike;
using WebDataContracts.ResponseModels.Hike;

namespace Core.Services;

public class HikeService : IHikeService
{
    private readonly HikeResponseFactory _hikeResponseFactory;
    private readonly IUserService _userService;
    private readonly IHikeRepository _hikeRepository;

    public HikeService(IHikeRepository hikeResponseRepository,
        HikeResponseFactory hikeResponseFactory,
        IUserService userService)
    {
        _hikeRepository = hikeResponseRepository;
        _hikeResponseFactory = hikeResponseFactory;
        _userService = userService;
    }

    public async Task<Result<HikeResponse>> CreateHikeAsync(CreateHikeRequest request, string userIdentifier, CancellationToken ctoken)
    {
        var userResult = await _userService.GetUserByIdentifierAsync(userIdentifier, ctoken);

        if (!userResult.Success)
            return Result.Fail<HikeResponse>(new Message(404, "User not found"));

        if (string.IsNullOrWhiteSpace(request.Name) ||
            request.Name.Length > 60 ||
            request.HikeLength == 0 ||
            request.Duration == 0)
        {
            return Result.Fail<HikeResponse>(new Message(400, "Hike properties are invalid."));
        }

        var hike = new Hike
        {
            Name = request.Name,
            HikeLength = request.HikeLength / 1000,
            Duration = request.Duration,
            Coordinates = request.Coordinates,
            CreatedBy = userIdentifier
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
        var result = await _hikeRepository.GetHikesAsync(
            createdBy,
            h => HikeOverviewResponse.Create(
                h.Identifier,
                h.Name,
                h.HikeLength,
                h.Duration,
                h.Coordinates,
                h.CreatedBy),
            ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<HikeOverviewResponse>>(new Message(500, "An error occurred while fetching hikes."));

        return Result.Ok(result.Value);
    }

    public async Task<Result> DeleteHikeAsync(string hikeIdentifier, string userIdentifier, CancellationToken ctoken)
    {
        var result = await _hikeRepository.GetHikeByIdentifierAsync(hikeIdentifier, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while deleting the hike."));

        if (!result.IsSuccess)
            return Result.Fail(new Message(404, $"Could not remove hike with id {hikeIdentifier}."));

        if (result.Value.CreatedBy != userIdentifier)
            return Result.Fail(new Message(401, $"Hike {hikeIdentifier} does not belong to {userIdentifier}"));

        await _hikeRepository.DeleteHikeAsync(result.Value, ctoken);

        return Result.Ok();
    }
}
