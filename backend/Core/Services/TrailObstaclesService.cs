using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using WebDataContracts.ResponseModels.TrailObstacle;

namespace Core.Services;

public class TrailObstaclesService : ITrailObstaclesService
{
    private readonly ITrailObstacleRepository _obstacleRepository;
    private readonly TrailObstaclesResponseFactory _responseFactory;
    private readonly IUserService _userService;
    private readonly ITrailService _trailService;

    public TrailObstaclesService(
        ITrailObstacleRepository obstacleResponseRepository,
        TrailObstaclesResponseFactory responseFactory,
        IUserService userService,
        ITrailService trailService)
    {
        _obstacleRepository = obstacleResponseRepository;
        _responseFactory = responseFactory;
        _userService = userService;
        _trailService = trailService;
    }

    public async Task<Result<IReadOnlyCollection<TrailObstacleResponse>>> GetTrailObstaclesByTrailIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _obstacleRepository.GetTrailObstaclesByTrailIdentifierAsync(identifier, to => to, ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<TrailObstacleResponse>>(new Message(500, "An error occurred while fetching trail obstacles."));

        return Result.Ok(_responseFactory.Create(result.Value));
    }

    public async Task<Result<TrailObstacleResponse?>> AddTrailObstacle(string userIdentifier, string trailIdentifier, string description, string issueType, decimal? longitude, decimal? latitude, CancellationToken ctoken)
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

        var result = await _obstacleRepository.AddTrailObstacleAsync(obstacle, ctoken);

        if (!result.IsSuccess)
            return Result.Fail<TrailObstacleResponse?>(new Message(500, "An error occurred while adding trail obstacle."));

        return Result.Ok<TrailObstacleResponse?>(_responseFactory.Create(result.Value));
    }

    public async Task<Result> AddSolvedVoteAsync(string userIdentifier, string trailObstacleIdentifier, CancellationToken ctoken)
    {
        var userIdResult = await _userService.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

        if (!userIdResult.Success)
            return Result.Fail(new Message(404, $"{userIdResult.Message}"));

        var obstacleResult = await _obstacleRepository.GetTrailObstacleByIdentifierAsync(trailObstacleIdentifier, ctoken);

        if (obstacleResult.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while adding solved vote for trail obstacle."));

        if (!obstacleResult.IsSuccess)
            return Result.Fail(new Message(404, $"No trail obstacle found with identifier: {trailObstacleIdentifier}"));

        if (obstacleResult.Value.SolvedVotes.Any(sv => sv.UserId == userIdResult.Value))
            return Result.Fail(new Message(409, $"User already voted on trail obstacle: {trailObstacleIdentifier}"));

        var solvedVote = new TrailObstacleSolvedVote
        {
            UserId = userIdResult.Value,
            TrailObstacleId = obstacleResult.Value.Id
        };

        var addResult = await _obstacleRepository.AddSolvedVoteAsync(solvedVote, ctoken);

        if (addResult.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while adding solved vote for trail obstacle."));

        return Result.Ok();
    }

    public async Task<Result> UpdateTrailObstacleAsync(string userIdentifier, string trailObstacleIdentifier, string? description, string? issueType, CancellationToken ctoken)
    {
        var userIdResult = await _userService.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

        if (!userIdResult.Success)
            return Result.Fail(new Message(404, $"{userIdResult.Message}"));

        var obstacleResult = await _obstacleRepository.GetTrailObstacleByIdentifierAndUserIdAsync(trailObstacleIdentifier, userIdResult.Value, ctoken);

        if (obstacleResult.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while updating trail obstacle."));

        if (!obstacleResult.IsSuccess)
            return Result.Fail(new Message(404, $"No trail obstacle found for user {userIdentifier} with identifier: {trailObstacleIdentifier}"));

        var obstacle = obstacleResult.Value;

        if (!string.IsNullOrEmpty(description))
            obstacle.Description = description;

        if (!string.IsNullOrEmpty(issueType) && Enum.TryParse<TrailIssueType>(issueType, out var issueTypeResult))
            obstacle.IssueType = issueTypeResult;

        var updateResult = await _obstacleRepository.UpdateTrailObstacleAsync(obstacle, ctoken);

        if (updateResult.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while updating trail obstacle."));

        return Result.Ok();
    }

    public async Task<Result> DeleteSolvedVoteByUserIdentifierAsync(string userIdentifier, string trailObstacleIdentifier, CancellationToken ctoken)
    {
        var userIdResult = await _userService.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

        if (!userIdResult.Success)
            return Result.Fail(new Message(404, $"{userIdResult.Message}"));

        var obstacleResult = await _obstacleRepository.GetTrailObstacleByIdentifierAsync(trailObstacleIdentifier, ctoken);

        if (obstacleResult.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while deleting solved vote for trail obstacle."));

        if (!obstacleResult.IsSuccess)
            return Result.Fail(new Message(404, $"No trail obstacle found for user {userIdentifier} with identifier: {trailObstacleIdentifier}"));

        var solvedVoteResult = await _obstacleRepository.GetSolvedVoteByObstacleIdAndUserIdAsync(obstacleResult.Value.Id, userIdResult.Value, ctoken);

        if (solvedVoteResult.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while deleting solved vote for trail obstacle."));

        if (!solvedVoteResult.IsSuccess)
            return Result.Fail(new Message(404, $"No solved vote found for obstacle {trailObstacleIdentifier} and user {userIdentifier}"));

        var deleteVoteResult = await _obstacleRepository.DeleteSolvedVoteAsync(solvedVoteResult.Value, ctoken);

        if (deleteVoteResult.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while deleting solved vote for trail obstacle."));

        return Result.Ok();
    }

    public async Task<Result> DeleteTrailObstacleAsync(string userIdentifier, string trailObstacleIdentifier, CancellationToken ctoken)
    {
        var userIdResult = await _userService.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

        if (!userIdResult.Success)
            return Result.Fail(new Message(404, $"{userIdResult.Message}"));

        var obstacleResult = await _obstacleRepository.GetTrailObstacleByIdentifierAndUserIdAsync(trailObstacleIdentifier, userIdResult.Value, ctoken);

        if (obstacleResult.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while deleting trail obstacle."));

        if (!obstacleResult.IsSuccess)
            return Result.Fail(new Message(404, $"No trail obstacle found for user {userIdentifier} with identifier: {trailObstacleIdentifier}"));

        var deleteResult = await _obstacleRepository.DeleteTrailObstacleAsync(obstacleResult.Value, ctoken);

        if (deleteResult.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while deleting trail obstacle."));

        return Result.Ok();
    }
}
