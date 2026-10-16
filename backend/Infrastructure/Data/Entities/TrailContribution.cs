// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

// keep-comment: its presence is what makes a trail user-contributed; curated trails have no row
public class TrailContribution
{
    public int TrailId { get; set; }
    public Trail? Trail { get; set; }
    public int? SubmittedByUserId { get; set; }
    public User? SubmittedBy { get; set; }
    public bool ShowSubmitterName { get; set; }
    public DateTime PublishedAt { get; set; } = DateTime.UtcNow;

    // keep-comment: copied from the submission, which is deleted with the account while this row stays
    public DateTime TransferAcceptedAt { get; set; }
    public int ConsentTextId { get; set; }
    public ConsentText? ConsentText { get; set; }

    // keep-comment: ICollection, not IReadOnlyCollection, or EF projections of it throw (docs/notes/ef-projection-needs-icollection-navigation.md)
    public ICollection<TrailContributionLike> Likes { get; set; } = [];
}
