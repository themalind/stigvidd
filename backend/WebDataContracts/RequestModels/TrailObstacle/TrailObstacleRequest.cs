// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.TrailObstacle;

public class TrailObstacleRequest
{
    public required string TrailIdentifier { get; set; }
    public required string Description { get; set; }
    public required string IssueType { get; set; }
    public decimal? IncidentLongitude { get; set; }
    public decimal? IncidentLatitude { get; set; }
}
