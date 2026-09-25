// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.TrailObstacle;

namespace Core.Factories;

public class TrailObstaclesResponseFactory
{
    public IReadOnlyCollection<TrailObstacleResponse> Create(IReadOnlyCollection<TrailObstacle> trailObstacles, int[] hiddenUserIds)
    {
        return trailObstacles.Select(trailObstacle => Create(trailObstacle, hiddenUserIds)).ToList();
    }

    public TrailObstacleResponse Create(TrailObstacle trailObstacle) => Create(trailObstacle, []);

    private static TrailObstacleResponse Create(TrailObstacle trailObstacle, int[] hiddenUserIds)
    {
        return TrailObstacleResponse.Create(
            trailObstacle.Identifier,
            trailObstacle.User?.Identifier,
            trailObstacle.Description,
            trailObstacle.IssueType.ToString(),
            GeoPointFactory.ToLongitude(trailObstacle.IncidentLocation),
            GeoPointFactory.ToLatitude(trailObstacle.IncidentLocation),
            trailObstacle.CreatedAt,
            trailObstacle.SolvedVotes
                .Where(solvedVote => !hiddenUserIds.Contains(solvedVote.UserId))
                .Select(solvedVote => TrailObstacleSolvedVoteResponse.Create(
                    solvedVote.User?.Identifier ?? throw new InvalidOperationException("TrailObstaclesResponseFactory: UserIdentifier can not be null"),
                    trailObstacle.Identifier))
                .ToList(),
            trailObstacle.SolvedVotes.Count);
    }
}
