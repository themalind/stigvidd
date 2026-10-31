// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data;
using Infrastructure.Enums;

namespace Core.Interfaces.Repositories;

// One per ReportedContentType. Every method works on the caller's context and never saves. keep-comment: callers own the transaction
public interface IReportableContentHandler
{
    ReportedContentType ContentType { get; }

    // The content_type tag on the report metric; a value from MetricTags.Values. keep-comment: dashboards query these strings
    string MetricTag { get; }

    AuthorDeletionOutcome WhenAuthorDeletesAccount { get; }

    Task<ReportableContent?> FindAsync(StigViddDbContext context, string contentIdentifier, int reporterUserId, CancellationToken ctoken);

    Task<bool> SetModerationStateAsync(StigViddDbContext context, int contentId, ModerationState state, CancellationToken ctoken);

    Task<bool> DeleteAsync(StigViddDbContext context, int contentId, ContentDeletionEffects effects, CancellationToken ctoken);

    Task<HashSet<int>> ExistingIdsAsync(StigViddDbContext context, IReadOnlyCollection<int> contentIds, CancellationToken ctoken);
}
