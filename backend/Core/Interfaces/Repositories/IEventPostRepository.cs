// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories;

public record EventPostRow(
    int Id,
    string Identifier,
    int? UserId,
    string? UserIdentifier,
    string? NickName,
    string Body,
    bool IsPinned,
    DateTime CreatedAt,
    DateTime? EditedAt);

// Pinned is empty unless asked for; Posts is oldest first. keep-comment: the page order the app renders
public sealed record EventBoardPage(IReadOnlyList<EventPostRow> Pinned, IReadOnlyList<EventPostRow> Posts, bool HasMore, DateTime? LastReadPostAt, bool Muted);

public sealed record CreatedEventPost(EventPostRow Post, IReadOnlyCollection<int> NotifyUserIds);

public sealed record EventPostTarget(int Id, string EventIdentifier, int? UserId);

public interface IEventPostRepository
{
    Task<RepositoryResult<EventBoardPage>> GetBoardAsync(int eventId, int viewerId, int[] hiddenUserIds, EventPageKey? before, int limit, bool includePinned, CancellationToken ctoken);

    // NotFound means the author is no longer a joined participant. NotifyUserIds are those due a push; their LastPostPushAt is already moved in the same save. keep-comment: the throttle is written with the post
    Task<RepositoryResult<CreatedEventPost>> CreateAsync(int eventId, int authorId, string body, DateTime now, TimeSpan pushThrottle, CancellationToken ctoken);

    // A post hidden by a report is NotFound, as for its author. keep-comment: the Moderation filter applies
    Task<RepositoryResult<EventPostTarget>> FindAsync(string postIdentifier, CancellationToken ctoken);

    Task<RepositoryResult<EventPostRow>> UpdateAsync(int postId, string body, DateTime now, CancellationToken ctoken);
    Task<RepositoryResult> DeleteAsync(int postId, CancellationToken ctoken);
    Task<RepositoryResult> SetPinnedAsync(int postId, bool pinned, CancellationToken ctoken);

    // NotFound means the caller is not a joined participant. keep-comment: an earlier time leaves the marker where it is
    Task<RepositoryResult> MarkReadAsync(int eventId, int userId, DateTime readUpTo, CancellationToken ctoken);
}
