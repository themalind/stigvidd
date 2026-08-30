// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;
using NetTopologySuite.Geometries;

namespace Infrastructure.Data.Entities;

public class TrailObstacle : BaseEntity
{
    public required string Description { get; set; }
    public required TrailIssueType IssueType { get; set; }

    /// <summary>
    /// WGS84 (SRID 4326) location of the incident, or null when the reporter did not
    /// pin it to a point. Geometry order is (X = longitude, Y = latitude).
    /// </summary>
    public Point? IncidentLocation { get; set; }
    public required int TrailId { get; set; }
    public required int? UserId { get; set; }
    public List<TrailObstacleSolvedVote> SolvedVotes { get; set; } = [];

    public Trail? Trail { get; set; }
    public User? User { get; set; }
}
