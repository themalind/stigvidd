// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services.Push;
using Infrastructure.Enums;
using WebDataContracts.RequestModels.Event;
using WebDataContracts.ResponseModels.Event;

namespace Core.Services.Events;

public class EventParticipationService : IEventParticipationService
{
    private readonly EventLoader _loader;
    private readonly IEventParticipantRepository _participantRepository;
    private readonly IEventInvitationRepository _invitationRepository;
    private readonly IUserBlockService _userBlockService;
    private readonly IPushQueue _pushQueue;

    public EventParticipationService(
        EventLoader loader,
        IEventParticipantRepository participantRepository,
        IEventInvitationRepository invitationRepository,
        IUserBlockService userBlockService,
        IPushQueue pushQueue)
    {
        _loader = loader;
        _participantRepository = participantRepository;
        _invitationRepository = invitationRepository;
        _userBlockService = userBlockService;
        _pushQueue = pushQueue;
    }

    public async Task<Result> JoinAsync(string userIdentifier, string identifier, CancellationToken ctoken)
    {
        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail(loaded.Message ?? EventErrors.Gone());

        var membership = loaded.Value.Membership;

        if (membership.ParticipantStatus == EventParticipantStatus.Joined)
            return Result.Ok();

        var refusal = membership.JoinRefusal();

        if (refusal is not null)
            return Result.Fail(refusal);

        var joined = await _participantRepository.JoinAsync(loaded.Value.Detail.Event.Id, loaded.Value.ViewerId, DateTime.UtcNow, ctoken);

        return joined.Status switch
        {
            RepositoryResultStatus.Success => Result.Ok(),
            RepositoryResultStatus.Conflict => await NoSpotTakenAsync(userIdentifier, identifier, ctoken),
            RepositoryResultStatus.NotFound => Result.Fail(new Message(409, "You cannot join this event.", EventErrorCodes.RemovedFromEvent)),
            _ => Result.Fail(new Message(500, "An error occurred while joining the event.")),
        };
    }

    // The event changed between the check and the UPDATE; reloading names the reason, and with none left it was the last spot. keep-comment: why Conflict is not always event_full
    private async Task<Result> NoSpotTakenAsync(string userIdentifier, string identifier, CancellationToken ctoken)
    {
        var reloaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (reloaded.Message is not null || reloaded.Value is null)
            return Result.Fail(reloaded.Message ?? EventErrors.Gone());

        if (reloaded.Value.Membership.ParticipantStatus == EventParticipantStatus.Joined)
            return Result.Ok();

        return Result.Fail(reloaded.Value.Membership.JoinRefusal() ?? new Message(409, "The event is full.", EventErrorCodes.EventFull));
    }

    public async Task<Result> MarkInterestedAsync(string userIdentifier, string identifier, CancellationToken ctoken)
    {
        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail(loaded.Message ?? EventErrors.Gone());

        var membership = loaded.Value.Membership;

        if (!membership.CanMarkInterested())
            return Result.Fail(membership.JoinRefusal() ?? EventErrors.NotAllowed());

        var marked = await _participantRepository.MarkInterestedAsync(loaded.Value.Detail.Event.Id, loaded.Value.ViewerId, ctoken);

        return marked.Status switch
        {
            RepositoryResultStatus.Success => Result.Ok(),
            RepositoryResultStatus.Conflict => Result.Fail(new Message(409, "You have already joined.")),
            _ => Result.Fail(new Message(500, "An error occurred while saving your interest.")),
        };
    }

    // Undo actions answer 204 when the event or the row is already gone. keep-comment: stale-state rule, the app just drops the row
    public async Task<Result> UnmarkInterestedAsync(string userIdentifier, string identifier, CancellationToken ctoken)
    {
        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message?.StatusCode == 404)
            return Result.Ok();

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail(loaded.Message ?? EventErrors.Gone());

        var unmarked = await _participantRepository.UnmarkInterestedAsync(loaded.Value.Detail.Event.Id, loaded.Value.ViewerId, ctoken);

        return unmarked.IsSuccess
            ? Result.Ok()
            : Result.Fail(new Message(500, "An error occurred while removing your interest."));
    }

    public async Task<Result> LeaveAsync(string userIdentifier, string identifier, CancellationToken ctoken)
    {
        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message?.StatusCode == 404)
            return Result.Ok();

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail(loaded.Message ?? EventErrors.Gone());

        var left = await _participantRepository.LeaveAsync(loaded.Value.Detail.Event.Id, loaded.Value.ViewerId, ctoken);

        if (!left.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while leaving the event."));

        if (left.Value.HandOver is not null)
        {
            foreach (var push in EventPushes.ForHandOver(left.Value.HandOver))
                _pushQueue.Enqueue(push);
        }

        return Result.Ok();
    }

    public async Task<Result<EventParticipantsResponse>> GetParticipantsAsync(string userIdentifier, string identifier, CancellationToken ctoken)
    {
        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail<EventParticipantsResponse>(loaded.Message ?? EventErrors.Gone());

        var detail = loaded.Value.Detail;
        var response = new EventParticipantsResponse
        {
            ParticipantCount = detail.Event.ParticipantCount,
            InterestedCount = detail.InterestedCount,
        };

        if (!loaded.Value.Membership.CanSeeParticipants())
            return Result.Ok(response);

        var rows = await _participantRepository.GetJoinedAsync(detail.Event.Id, ctoken);

        if (!rows.IsSuccess || rows.Value is null)
            return Result.Fail<EventParticipantsResponse>(new Message(500, "An error occurred while fetching the participants."));

        var hidden = loaded.Value.Membership.SeesBlockedParticipants()
            ? []
            : await _userBlockService.GetHiddenUserIdsForReadAsync(loaded.Value.ViewerId, ctoken);

        response.Participants = rows.Value
            .Where(r => !hidden.Contains(r.UserId))
            .Select(r => new EventParticipantResponse
            {
                UserIdentifier = r.UserIdentifier,
                NickName = r.NickName,
                Role = r.Role.ToString(),
                JoinedAt = r.JoinedAt,
            })
            .ToList();

        var invitees = await _invitationRepository.GetPendingForEventAsync(detail.Event.Id, ctoken);

        if (!invitees.IsSuccess || invitees.Value is null)
            return Result.Fail<EventParticipantsResponse>(new Message(500, "An error occurred while fetching the invitations."));

        response.Invited = invitees.Value
            .Where(i => !hidden.Contains(i.UserId))
            .Select(i => new EventInviteeResponse
            {
                UserIdentifier = i.UserIdentifier,
                NickName = i.NickName,
                InvitedByNickName = i.InvitedByUserId is int inviterId && hidden.Contains(inviterId) ? null : i.InvitedByNickName,
                InvitedAt = i.InvitedAt,
            })
            .ToList();

        return Result.Ok(response);
    }

    public async Task<Result> RemoveParticipantAsync(string userIdentifier, string identifier, string participantIdentifier, CancellationToken ctoken)
    {
        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail(loaded.Message ?? EventErrors.Gone());

        var membership = loaded.Value.Membership;
        var refusal = membership.RemoveRefusal(EventParticipantRole.Participant);

        if (refusal is not null)
            return Result.Fail(refusal);

        var eventId = loaded.Value.Detail.Event.Id;
        var target = await _participantRepository.GetAsync(eventId, participantIdentifier, ctoken);

        if (target.Status == RepositoryResultStatus.NotFound || target.Value?.Status == EventParticipantStatus.Removed)
            return Result.Ok();

        if (!target.IsSuccess || target.Value is null)
            return Result.Fail(new Message(500, "An error occurred while fetching the participant."));

        if (target.Value.UserId == loaded.Value.ViewerId)
            return Result.Fail(new Message(400, "Leave the event instead of removing yourself."));

        var targetRefusal = membership.RemoveRefusal(target.Value.Role);

        if (targetRefusal is not null)
            return Result.Fail(targetRefusal);

        EventParticipantRole[] removable = [.. new[] { EventParticipantRole.CoHost, EventParticipantRole.Participant }.Where(membership.CanRemove)];
        var removed = await _participantRepository.RemoveAsync(eventId, target.Value.UserId, removable, ctoken);

        if (removed.Status == RepositoryResultStatus.Conflict)
            return Result.Fail(EventErrors.NotAllowed());

        return removed.IsSuccess || removed.Status == RepositoryResultStatus.NotFound
            ? Result.Ok()
            : Result.Fail(new Message(500, "An error occurred while removing the participant."));
    }

    public async Task<Result> SetRoleAsync(string userIdentifier, string identifier, string participantIdentifier, EventRoleRequest request, CancellationToken ctoken)
    {
        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail(loaded.Message ?? EventErrors.Gone());

        var refusal = loaded.Value.Membership.RoleChangeRefusal();

        if (refusal is not null)
            return Result.Fail(refusal);

        var e = loaded.Value.Detail.Event;
        var target = await _participantRepository.GetAsync(e.Id, participantIdentifier, ctoken);

        if (target.Status == RepositoryResultStatus.NotFound)
            return Result.Fail(new Message(404, "Participant not found."));

        if (!target.IsSuccess || target.Value is null)
            return Result.Fail(new Message(500, "An error occurred while fetching the participant."));

        if (target.Value.Status != EventParticipantStatus.Joined)
            return Result.Fail(new Message(404, "Participant not found."));

        if (target.Value.Role == EventParticipantRole.Organizer)
            return Result.Fail(OrganizerRoleRefusal());

        var role = Enum.Parse<EventParticipantRole>(request.Role);

        if (target.Value.Role == role)
            return Result.Ok();

        var changed = await _participantRepository.SetRoleAsync(e.Id, target.Value.UserId, role, ctoken);

        if (changed.Status == RepositoryResultStatus.NotFound)
            return Result.Fail(new Message(404, "Participant not found."));

        if (changed.Status == RepositoryResultStatus.Conflict)
            return Result.Fail(OrganizerRoleRefusal());

        if (!changed.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while changing the role."));

        if (role == EventParticipantRole.CoHost)
            _pushQueue.Enqueue(EventPushes.PromotedToCoHost(e.Identifier, e.Title, target.Value.UserId, loaded.Value.ViewerId));

        return Result.Ok();
    }

    private static Message OrganizerRoleRefusal()
    {
        return new Message(400, "The organizer's role changes only through a hand-over.");
    }

    public async Task<Result> SetMutedAsync(string userIdentifier, string identifier, EventMuteRequest request, CancellationToken ctoken)
    {
        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail(loaded.Message ?? EventErrors.Gone());

        if (!loaded.Value.Membership.CanReadBoard())
            return Result.Fail(EventErrors.NotAllowed());

        var muted = await _participantRepository.SetMutedAsync(loaded.Value.Detail.Event.Id, loaded.Value.ViewerId, request.Muted, ctoken);

        if (muted.Status == RepositoryResultStatus.NotFound)
            return Result.Fail(EventErrors.NotAllowed());

        return muted.IsSuccess
            ? Result.Ok()
            : Result.Fail(new Message(500, "An error occurred while saving the setting."));
    }
}
