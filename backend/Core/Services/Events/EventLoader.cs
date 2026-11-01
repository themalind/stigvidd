// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Enums;

namespace Core.Services.Events;

public sealed record LoadedEvent(int ViewerId, EventDetail Detail, EventMembership Membership, bool ShowOrganizer, int[] HiddenUserIds);

// Loads an event with the caller's membership and applies the visibility rules every event action starts with. keep-comment: one entry point for EventService and EventParticipationService
public class EventLoader
{
    private readonly IEventRepository _eventRepository;
    private readonly IUserRepository _userRepository;
    private readonly IUserBlockService _userBlockService;

    public EventLoader(IEventRepository eventRepository, IUserRepository userRepository, IUserBlockService userBlockService)
    {
        _eventRepository = eventRepository;
        _userRepository = userRepository;
        _userBlockService = userBlockService;
    }

    // Hidden means blocked by the viewer, so naming the reason tells them nothing new. keep-comment: why organizer_blocked is safe to return
    public async Task<Result<LoadedEvent>> LoadAsync(string userIdentifier, string identifier, CancellationToken ctoken)
    {
        var viewer = await ResolveUserAsync(userIdentifier, ctoken);

        if (viewer.Message is not null)
            return Result.Fail<LoadedEvent>(viewer.Message);

        var detail = await _eventRepository.GetDetailAsync(identifier, viewer.Value, ctoken);

        if (detail.Status == RepositoryResultStatus.NotFound)
            return Result.Fail<LoadedEvent>(EventErrors.Gone());

        if (!detail.IsSuccess)
            return Result.Fail<LoadedEvent>(new Message(500, "An error occurred while fetching the event."));

        var membership = EventMembership.Of(detail.Value, DateTime.UtcNow);

        if (!membership.CanView())
            return Result.Fail<LoadedEvent>(EventErrors.Gone());

        var hidden = await _userBlockService.GetHiddenUserIdsForReadAsync(viewer.Value, ctoken);
        var organizerHidden = detail.Value.OrganizerUserId is int organizerId && hidden.Contains(organizerId);
        var isInside = detail.Value.MyStatus is EventParticipantStatus.Joined or EventParticipantStatus.Interested
            || detail.Value.HasPendingInvite;

        if (organizerHidden && !isInside)
            return Result.Fail<LoadedEvent>(new Message(404, "The event is arranged by someone you have blocked.", EventErrorCodes.OrganizerBlocked));

        return Result.Ok(new LoadedEvent(viewer.Value, detail.Value, membership, !organizerHidden, hidden));
    }

    public async Task<Result<int>> ResolveUserAsync(string userIdentifier, CancellationToken ctoken)
    {
        var userId = await _userRepository.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

        if (userId.Status == RepositoryResultStatus.NotFound)
            return Result.Fail<int>(new Message(404, "User not found"));

        if (!userId.IsSuccess)
            return Result.Fail<int>(new Message(500, "An error occurred while fetching the user."));

        return Result.Ok(userId.Value);
    }

}
