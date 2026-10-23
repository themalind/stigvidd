// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;
using NetTopologySuite.Geometries;

namespace Infrastructure.Data.Entities;

public class HikeSubmission : BaseEntity
{
    public int UserId { get; set; }
    public User? User { get; set; }
    public int? SourceHikeId { get; set; }
    public Hike? SourceHike { get; set; }

    public required string Name { get; set; }
    public string Description { get; set; } = string.Empty;
    // keep-comment: null once rejected; a rejection keeps only that it happened, not the route
    public LineString? GeoPath { get; set; }
    public LineString? OriginalGeoPath { get; set; }
    public decimal TrailLength { get; set; }
    public double LongestGapMetres { get; set; }
    public int Classification { get; set; }
    public string Parking { get; set; } = string.Empty;
    public string GettingThere { get; set; } = string.Empty;
    public string PublicTransport { get; set; } = string.Empty;
    public string AccessibilityInfo { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;

    public bool ShowSubmitterName { get; set; }
    public DateTime TransferAcceptedAt { get; set; }
    public int ConsentTextId { get; set; }
    public ConsentText? ConsentText { get; set; }

    public HikeSubmissionStatus Status { get; set; } = HikeSubmissionStatus.Pending;
    public string? RejectionReason { get; set; }
    public string? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public int? PublishedTrailId { get; set; }
    public Trail? PublishedTrail { get; set; }

    // keep-comment: ICollection, not IReadOnlyCollection, or EF projections of it throw (docs/notes/ef-projection-needs-icollection-navigation.md)
    public ICollection<HikeSubmissionImage> Images { get; set; } = [];
}
