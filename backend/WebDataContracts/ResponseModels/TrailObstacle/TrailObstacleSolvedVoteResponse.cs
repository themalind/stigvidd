// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.TrailObstacle;

public class TrailObstacleSolvedVoteResponse
{
    public required string UserIdentifier { get; set; }
    public required string TrailObstacleIdentifier { get; set; }

    public static TrailObstacleSolvedVoteResponse Create(string userIdentifier, string trailObstacleIdentifier)
    {
        return new TrailObstacleSolvedVoteResponse
        {
            UserIdentifier = userIdentifier,
            TrailObstacleIdentifier = trailObstacleIdentifier
        };
    }
}
