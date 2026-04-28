using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels.TrailObstacle;

namespace Core.Services;

public class TrailObstaclesService : ITrailObstaclesService
{
    private readonly ITrailObstacleResponseRepository _obstacleResponseRepository;
    private readonly ILogger<TrailObstaclesService> _logger;
    private readonly TrailObstaclesResponseFactory _responseFactory;
    private readonly IUserService _userService;
    private readonly ITrailService _trailService;

    public TrailObstaclesService(
        ITrailObstacleResponseRepository obstacleResponseRepository,
        ILogger<TrailObstaclesService> logger,
        TrailObstaclesResponseFactory responseFactory,
        IUserService userService,
        ITrailService trailService)
    {
        _obstacleResponseRepository = obstacleResponseRepository;
        _logger = logger;
        _responseFactory = responseFactory;
        _userService = userService;
        _trailService = trailService;
    }

    public async Task<Result<IReadOnlyCollection<TrailObstacleResponse>>> GetTrailObstaclesByTrailIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            var result = await _obstacleResponseRepository.GetTrailObstaclesByTrailIdentifierAsync(identifier, ctoken);

            if (!result.IsSuccess)
                return Result.Fail<IReadOnlyCollection<TrailObstacleResponse>>(new Message(500, "An error occurred while fetching trail obstacles."));

            return Result.Ok(_responseFactory.Create(result.Value));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred while fetching trail obstacles for trail {identifier}", identifier);

            return Result.Fail<IReadOnlyCollection<TrailObstacleResponse>>(new Message(500, "An error occurred while fetching trail obstacles."));
        }
    }

    public async Task<Result<TrailObstacleResponse?>> AddTrailObstacle(string userIdentifier, string trailIdentifier, string description, string issueType, decimal? longitude, decimal? latitude, CancellationToken ctoken)
    {
        try
        {
            var userIdResult = await _userService.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

            if (!userIdResult.Success)
                return Result.Fail<TrailObstacleResponse?>(new Message(404, $"{userIdResult.Message}"));

            var trailIdResult = await _trailService.GetTrailIdByIdentifierAsync(trailIdentifier, ctoken);

            if (!trailIdResult.Success)
                return Result.Fail<TrailObstacleResponse?>(new Message(404, $"{trailIdResult.Message}"));

            var isParsed = Enum.TryParse<TrailIssueType>(issueType, out var issueTypeResult);

            var obstacle = new TrailObstacle
            {
                Description = description,
                IssueType = isParsed ? issueTypeResult : TrailIssueType.Other,
                UserId = userIdResult.Value,
                TrailId = trailIdResult.Value,
                IncidentLongitude = longitude,
                IncidentLatitude = latitude,
            };

            var result = await _obstacleResponseRepository.AddTrailObstacleAsync(obstacle, ctoken);

            if (!result.IsSuccess)
                return Result.Fail<TrailObstacleResponse?>(new Message(500, "An error occurred while adding trail obstacle."));

            return Result.Ok<TrailObstacleResponse?>(_responseFactory.Create(result.Value));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred while adding trail obstacle for {userIdentifier} and {trailIdentifier}", userIdentifier, trailIdentifier);

            return Result.Fail<TrailObstacleResponse?>(new Message(500, "An error occurred while adding trail obstacle."));
        }
    }

    public async Task<Result> AddSolvedVoteAsync(string userIdentifier, string trailObstacleIdentifier, CancellationToken ctoken)
    {
        try
        {
            var userIdResult = await _userService.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

            if (!userIdResult.Success)
                return Result.Fail(new Message(404, $"{userIdResult.Message}"));

            var obstacleResult = await _obstacleResponseRepository.GetTrailObstacleByIdentifierAsync(trailObstacleIdentifier, ctoken);

            if (!obstacleResult.IsSuccess)
                return Result.Fail(new Message(404, $"No trail obstacle found with identifier: {trailObstacleIdentifier}"));

            if (obstacleResult.Value.SolvedVotes.Any(sv => sv.UserId == userIdResult.Value))
                return Result.Fail(new Message(409, $"User already voted on trail obstacle: {trailObstacleIdentifier}"));

            var solvedVote = new TrailObstacleSolvedVote
            {
                UserId = userIdResult.Value,
                TrailObstacleId = obstacleResult.Value.Id
            };

            await _obstacleResponseRepository.AddSolvedVoteAsync(solvedVote, ctoken);

            return Result.Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred while adding solved vote for trail obstacle {trailObstacleIdentifier} and user {userIdentifier}", trailObstacleIdentifier, userIdentifier);

            return Result.Fail(new Message(500, "An error occurred while adding solved vote for trail obstacle."));
        }
    }

    public async Task<Result> UpdateTrailObstacleAsync(string userIdentifier, string trailObstacleIdentifier, string? description, string? issueType, CancellationToken ctoken)
    {
        try
        {
            var userIdResult = await _userService.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

            if (!userIdResult.Success)
                return Result.Fail(new Message(404, $"{userIdResult.Message}"));

            var obstacleResult = await _obstacleResponseRepository.GetTrailObstacleByIdentifierAndUserIdAsync(trailObstacleIdentifier, userIdResult.Value, ctoken);

            if (!obstacleResult.IsSuccess)
                return Result.Fail(new Message(404, $"No trail obstacle found for user {userIdentifier} with identifier: {trailObstacleIdentifier}"));

            var obstacle = obstacleResult.Value;

            if (!string.IsNullOrEmpty(description))
                obstacle.Description = description;

            if (!string.IsNullOrEmpty(issueType) && Enum.TryParse<TrailIssueType>(issueType, out var issueTypeResult))
                obstacle.IssueType = issueTypeResult;

            await _obstacleResponseRepository.UpdateTrailObstacleAsync(obstacle, ctoken);

            return Result.Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred while updating trail obstacle {trailObstacleIdentifier} for user {userIdentifier}", trailObstacleIdentifier, userIdentifier);

            return Result.Fail(new Message(500, "An error occurred while updating trail obstacle."));
        }
    }

    public async Task<Result> DeleteSolvedVoteByUserIdentifierAsync(string userIdentifier, string trailObstacleIdentifier, CancellationToken ctoken)
    {
        try
        {
            var userIdResult = await _userService.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

            if (!userIdResult.Success)
                return Result.Fail(new Message(404, $"{userIdResult.Message}"));

            var obstacleResult = await _obstacleResponseRepository.GetTrailObstacleByIdentifierAsync(trailObstacleIdentifier, ctoken);

            if (!obstacleResult.IsSuccess)
                return Result.Fail(new Message(404, $"No trail obstacle found for user {userIdentifier} with identifier: {trailObstacleIdentifier}"));

            var solvedVoteResult = await _obstacleResponseRepository.GetSolvedVoteByObstacleIdAndUserIdAsync(obstacleResult.Value.Id, userIdResult.Value, ctoken);

            if (!solvedVoteResult.IsSuccess)
                return Result.Fail(new Message(404, $"No solved vote found for obstacle {trailObstacleIdentifier} and user {userIdentifier}"));

            await _obstacleResponseRepository.DeleteSolvedVoteAsync(solvedVoteResult.Value, ctoken);

            return Result.Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete solved vote from trail obstacle {trailObstacleIdentifier} for user {userIdentifier}", trailObstacleIdentifier, userIdentifier);

            return Result.Fail(new Message(500, "An error occurred while deleting solved vote for trail obstacle."));
        }
    }

    public async Task<Result> DeleteTrailObstacleAsync(string userIdentifier, string trailObstacleIdentifier, CancellationToken ctoken)
    {
        try
        {
            var userIdResult = await _userService.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

            if (!userIdResult.Success)
                return Result.Fail(new Message(404, $"{userIdResult.Message}"));

            var obstacleResult = await _obstacleResponseRepository.GetTrailObstacleByIdentifierAndUserIdAsync(trailObstacleIdentifier, userIdResult.Value, ctoken);

            if (!obstacleResult.IsSuccess)
                return Result.Fail(new Message(404, $"No trail obstacle found for user {userIdentifier} with identifier: {trailObstacleIdentifier}"));

            await _obstacleResponseRepository.DeleteTrailObstacleAsync(obstacleResult.Value, ctoken);

            return Result.Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete trail obstacle {trailObstacleIdentifier} for user {userIdentifier}", trailObstacleIdentifier, userIdentifier);

            return Result.Fail(new Message(500, "An error occurred while deleting trail obstacle."));
        }
    }
}
