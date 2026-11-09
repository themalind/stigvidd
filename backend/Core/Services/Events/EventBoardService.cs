// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services.Push;
using Microsoft.Extensions.Options;
using WebDataContracts.RequestModels.Event;
using WebDataContracts.ResponseModels.Event;

namespace Core.Services.Events;

public class EventBoardService : IEventBoardService
{
    private readonly EventLoader _loader;
    private readonly IEventPostRepository _postRepository;
    private readonly IPushQueue _pushQueue;
    private readonly EventLimits _limits;

    public EventBoardService(
        EventLoader loader,
        IEventPostRepository postRepository,
        IPushQueue pushQueue,
        IOptions<EventLimits> limits)
    {
        _loader = loader;
        _postRepository = postRepository;
        _pushQueue = pushQueue;
        _limits = limits.Value;
    }

    public async Task<Result<EventBoardResponse>> GetBoardAsync(string userIdentifier, string identifier, EventBoardQuery query, CancellationToken ctoken)
    {
        if (!EventCursor.TryDecode(query.Cursor, out var before))
            return Result.Fail<EventBoardResponse>(new Message(400, "Invalid cursor."));

        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail<EventBoardResponse>(loaded.Message ?? EventErrors.Gone());

        var membership = loaded.Value.Membership;

        if (membership.PostRefusal() is Message refusal)
            return Result.Fail<EventBoardResponse>(refusal);

        var viewerId = loaded.Value.ViewerId;
        var page = await _postRepository.GetBoardAsync(
            loaded.Value.Detail.Event.Id,
            viewerId,
            [.. loaded.Value.HiddenUserIds],
            before,
            query.Limit,
            includePinned: before is null,
            ctoken);

        if (!page.IsSuccess || page.Value is null)
            return Result.Fail<EventBoardResponse>(new Message(500, "An error occurred while fetching the board."));

        var board = page.Value;
        var oldest = board.Posts.Count > 0 ? board.Posts[0] : null;

        return Result.Ok(new EventBoardResponse
        {
            Pinned = board.Pinned.Select(p => EventResponseFactory.CreatePost(p, viewerId, membership)).ToList(),
            Posts = board.Posts.Select(p => EventResponseFactory.CreatePost(p, viewerId, membership)).ToList(),
            NextCursor = board.HasMore && oldest is not null ? EventCursor.Encode(new EventPageKey(oldest.CreatedAt, oldest.Id)) : null,
            LastReadPostAt = board.LastReadPostAt,
            Muted = board.Muted,
        });
    }

    public async Task<Result<EventPostResponse>> CreatePostAsync(string userIdentifier, string identifier, EventPostRequest request, CancellationToken ctoken)
    {
        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail<EventPostResponse>(loaded.Message ?? EventErrors.Gone());

        var refusal = loaded.Value.Membership.PostRefusal();

        if (refusal is not null)
            return Result.Fail<EventPostResponse>(refusal);

        var e = loaded.Value.Detail.Event;
        var created = await _postRepository.CreateAsync(e.Id, loaded.Value.ViewerId, request.Body, request.ClientRequestId, DateTime.UtcNow, _limits.PostPushThrottle, ctoken);

        if (created.Status == RepositoryResultStatus.NotFound)
            return Result.Fail<EventPostResponse>(await RefusedSinceAsync(userIdentifier, identifier, ctoken));

        if (!created.IsSuccess || created.Value is null)
            return Result.Fail<EventPostResponse>(new Message(500, "An error occurred while saving the post."));

        var post = created.Value.Post;

        if (created.Value.NotifyUserIds.Count > 0 && post.NickName is not null)
            _pushQueue.Enqueue(EventPushes.Post(e.Identifier, e.Title, post.NickName, post.Body, created.Value.NotifyUserIds, loaded.Value.ViewerId));

        return Result.Ok(EventResponseFactory.CreatePost(post, loaded.Value.ViewerId, loaded.Value.Membership));
    }

    // Left or removed between the check and the save; reloading names which. keep-comment: mirrors NoSpotTakenAsync for join
    private async Task<Message> RefusedSinceAsync(string userIdentifier, string identifier, CancellationToken ctoken)
    {
        var reloaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (reloaded.Message is not null || reloaded.Value is null)
            return reloaded.Message ?? EventErrors.Gone();

        return reloaded.Value.Membership.PostRefusal() ?? EventErrors.NotAllowed();
    }

    // A time ahead of the server's is cut to now, so a bad clock cannot hide posts still to come. keep-comment: why the marker is clamped
    public async Task<Result> MarkReadAsync(string userIdentifier, string identifier, EventPostsReadRequest request, CancellationToken ctoken)
    {
        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail(loaded.Message ?? EventErrors.Gone());

        if (loaded.Value.Membership.PostRefusal() is Message refusal)
            return Result.Fail(refusal);

        var now = DateTime.UtcNow;
        var readUpTo = UtcDates.ToUtc(request.ReadUpTo);
        var marked = await _postRepository.MarkReadAsync(loaded.Value.Detail.Event.Id, loaded.Value.ViewerId, readUpTo > now ? now : readUpTo, ctoken);

        if (marked.Status == RepositoryResultStatus.NotFound)
            return Result.Fail(EventErrors.NotAllowed());

        return marked.IsSuccess
            ? Result.Ok()
            : Result.Fail(new Message(500, "An error occurred while saving the read marker."));
    }

    public async Task<Result<EventPostResponse>> UpdatePostAsync(string userIdentifier, string postIdentifier, EventPostRequest request, CancellationToken ctoken)
    {
        var target = await FindPostAsync(postIdentifier, ctoken);

        if (target.Message is not null || target.Value is null)
            return Result.Fail<EventPostResponse>(target.Message ?? EventErrors.PostGone());

        var loaded = await _loader.LoadAsync(userIdentifier, target.Value.EventIdentifier, ctoken);

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail<EventPostResponse>(loaded.Message ?? EventErrors.Gone());

        if (target.Value.UserId != loaded.Value.ViewerId)
            return Result.Fail<EventPostResponse>(EventErrors.NotAllowed());

        var refusal = loaded.Value.Membership.PostRefusal();

        if (refusal is not null)
            return Result.Fail<EventPostResponse>(refusal);

        var updated = await _postRepository.UpdateAsync(target.Value.Id, request.Body, DateTime.UtcNow, ctoken);

        if (updated.Status == RepositoryResultStatus.NotFound)
            return Result.Fail<EventPostResponse>(EventErrors.PostGone());

        if (!updated.IsSuccess || updated.Value is null)
            return Result.Fail<EventPostResponse>(new Message(500, "An error occurred while saving the post."));

        return Result.Ok(EventResponseFactory.CreatePost(updated.Value, loaded.Value.ViewerId, loaded.Value.Membership));
    }

    // The author may delete their own post even after leaving, without the event in view. keep-comment: it is their text
    public async Task<Result> DeletePostAsync(string userIdentifier, string postIdentifier, CancellationToken ctoken)
    {
        var target = await FindPostAsync(postIdentifier, ctoken);

        if (target.Message?.StatusCode == 404)
            return Result.Ok();

        if (target.Message is not null || target.Value is null)
            return Result.Fail(target.Message ?? EventErrors.PostGone());

        var viewer = await _loader.ResolveUserAsync(userIdentifier, ctoken);

        if (viewer.Message is not null)
            return Result.Fail(viewer.Message);

        if (target.Value.UserId != viewer.Value)
        {
            var loaded = await _loader.LoadAsync(userIdentifier, target.Value.EventIdentifier, ctoken);

            if (loaded.Message?.StatusCode == 404)
                return Result.Ok();

            if (loaded.Message is not null || loaded.Value is null)
                return Result.Fail(loaded.Message ?? EventErrors.Gone());

            if (!loaded.Value.Membership.CanPinOrDeletePosts())
                return Result.Fail(EventErrors.NotAllowed());
        }

        var deleted = await _postRepository.DeleteAsync(target.Value.Id, ctoken);

        return deleted.IsSuccess
            ? Result.Ok()
            : Result.Fail(new Message(500, "An error occurred while deleting the post."));
    }

    public async Task<Result> SetPinnedAsync(string userIdentifier, string postIdentifier, EventPostPinRequest request, CancellationToken ctoken)
    {
        var target = await FindPostAsync(postIdentifier, ctoken);

        if (target.Message is not null || target.Value is null)
            return Result.Fail(target.Message ?? EventErrors.PostGone());

        var loaded = await _loader.LoadAsync(userIdentifier, target.Value.EventIdentifier, ctoken);

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail(loaded.Message ?? EventErrors.Gone());

        if (!loaded.Value.Membership.CanPinOrDeletePosts())
            return Result.Fail(EventErrors.NotAllowed());

        var pinned = await _postRepository.SetPinnedAsync(target.Value.Id, request.Pinned, ctoken);

        if (pinned.Status == RepositoryResultStatus.NotFound)
            return Result.Fail(EventErrors.PostGone());

        return pinned.IsSuccess
            ? Result.Ok()
            : Result.Fail(new Message(500, "An error occurred while pinning the post."));
    }

    private async Task<Result<EventPostTarget>> FindPostAsync(string postIdentifier, CancellationToken ctoken)
    {
        var target = await _postRepository.FindAsync(postIdentifier, ctoken);

        if (target.Status == RepositoryResultStatus.NotFound)
            return Result.Fail<EventPostTarget>(EventErrors.PostGone());

        if (!target.IsSuccess || target.Value is null)
            return Result.Fail<EventPostTarget>(new Message(500, "An error occurred while fetching the post."));

        return Result.Ok(target.Value);
    }

}
