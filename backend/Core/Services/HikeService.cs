using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging;
using WebDataContracts.RequestModels.Hike;
using WebDataContracts.ResponseModels.Hike;

namespace Core.Services;

public class HikeService : IHikeService
{
    private readonly HikeResponseFactory _hikeResponseFactory;
    private readonly ILogger<HikeService> _logger;
    private readonly IUserService _userService;
    private readonly IHikeResponseRepository _hikeResponseRepository;

    public HikeService(IHikeResponseRepository hikeResponseRepository,
        HikeResponseFactory hikeResponseFactory,
        ILogger<HikeService> logger,
        IUserService userService)
    {
        _hikeResponseRepository = hikeResponseRepository;
        _hikeResponseFactory = hikeResponseFactory;
        _logger = logger;
        _userService = userService;
    }

    public async Task<Result<HikeResponse>> CreateHikeAsync(CreateHikeRequest request, string userIdentifier, CancellationToken ctoken)
    {
        try
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

            var result = await _hikeResponseRepository.CreateHikeAsync(hike, ctoken);

            if (!result.IsSuccess)
                return Result.Fail<HikeResponse>(new Message(500, "An error occurred while adding the hike."));

            _logger.LogInformation("Hike {hikeId} added successfully by user {userId}.", result.Value.Id, userIdentifier);

            return Result.Ok(_hikeResponseFactory.Create(result.Value));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating Hike by user: {userIdentifier}", userIdentifier);

            return Result.Fail<HikeResponse>(new Message(500, "An error occured while adding the hike."));
        }
    }

    public async Task<Result<HikeResponse>> GetHikeByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            var result = await _hikeResponseRepository.GetHikeByIdentifierAsync(identifier, ctoken);

            if (!result.IsSuccess)
                return Result.Fail<HikeResponse>(new Message(404, "Hike not found"));

            return Result.Ok(_hikeResponseFactory.Create(result.Value));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching hike with identifier {identifier}", identifier);
            return Result.Fail<HikeResponse>(new Message(500, "An error occurred while fetching the hike."));
        }
    }

    public async Task<Result<IReadOnlyCollection<HikeOverviewResponse>>> GetHikesAsync(string? createdBy, CancellationToken ctoken)
    {
        try
        {
            var result = await _hikeResponseRepository.GetHikesAsync(createdBy, ctoken);

            if (!result.IsSuccess)
                return Result.Fail<IReadOnlyCollection<HikeOverviewResponse>>(new Message(500, "An error occurred while fetching hikes."));

            return Result.Ok(result.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching hikes for user {createdBy}", createdBy);
            return Result.Fail<IReadOnlyCollection<HikeOverviewResponse>>(new Message(500, "An error occurred while fetching hikes."));
        }
    }

    public async Task<Result> DeleteHikeAsync(string hikeIdentifier, string userIdentifier, CancellationToken ctoken)
    {
        try
        {
            var result = await _hikeResponseRepository.GetHikeByIdentifierAsync(hikeIdentifier, ctoken);

            if (!result.IsSuccess)
                return Result.Fail(new Message(404, $"Could not remove hike with id {hikeIdentifier}."));

            if (result.Value.CreatedBy != userIdentifier)
                return Result.Fail(new Message(401, $"Hike {hikeIdentifier} does not belong to {userIdentifier}"));

            await _hikeResponseRepository.DeleteHikeAsync(result.Value, ctoken);

            return Result.Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting hike {hikeIdentifier} for user {userIdentifier}", hikeIdentifier, userIdentifier);
            return Result.Fail(new Message(500, "An error occurred while deleting the hike."));
        }
    }
}
