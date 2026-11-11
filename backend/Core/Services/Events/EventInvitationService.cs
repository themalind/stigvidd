// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services.Push;
using Infrastructure.Enums;
using Microsoft.Extensions.Options;
using WebDataContracts.RequestModels.Event;
using WebDataContracts.ResponseModels.Event;

namespace Core.Services.Events;

// The share pattern without the friendship check: any user can be invited by nickname, all or nothing. keep-comment: plan decision, HikeShareDistributor is the model
public class EventInvitationService : IEventInvitationService
{
    // Bounds the list behind the badge; more pending invitations than this to upcoming events is not a real case. keep-comment: why this list has no cursor
    public const int MaxPendingListed = 100;

    private readonly EventLoader _loader;
    private readonly IEventInvitationRepository _invitationRepository;
    private readonly IEventParticipantRepository _participantRepository;
    private readonly IUserBlockService _userBlockService;
    private readonly IPushQueue _pushQueue;
    private readonly EventResponseFactory _factory;
    private readonly EventLimits _limits;

    public EventInvitationService(
        EventLoader loader,
        IEventInvitationRepository invitationRepository,
        IEventParticipantRepository participantRepository,
        IUserBlockService userBlockService,
        IPushQueue pushQueue,
        EventResponseFactory factory,
        IOptions<EventLimits> limits)
    {
        _loader = loader;
        _invitationRepository = invitationRepository;
        _participantRepository = participantRepository;
        _userBlockService = userBlockService;
        _pushQueue = pushQueue;
        _factory = factory;
        _limits = limits.Value;
    }

    public async Task<Result> InviteAsync(string userIdentifier, string identifier, EventInviteRequest request, CancellationToken ctoken)
    {
        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail(loaded.Message ?? EventErrors.Gone());

        var refusal = loaded.Value.Membership.InviteRefusal();

        if (refusal is not null)
            return Result.Fail(refusal);

        var e = loaded.Value.Detail.Event;

        if (e.MaxParticipants.HasValue && e.ParticipantCount >= e.MaxParticipants.Value)
            return Result.Fail(new Message(409, "The event is full.", EventErrorCodes.EventFull));

        var names = request.NickNames.Select(n => n.Trim()).Distinct(StringComparer.Ordinal).ToList();
        var found = await _invitationRepository.FindByNickNamesAsync(names, ctoken);

        if (!found.IsSuccess || found.Value is null)
            return Result.Fail(new Message(500, "An error occurred while looking up the invitees."));

        // The app drops these chips and keeps the rest; users/search already tells whether a nickname exists. keep-comment: why naming them leaks nothing new
        var unknown = names.Where(n => found.Value.All(u => u.NickName != n)).ToList();

        if (unknown.Count > 0)
        {
            return Result.Fail(new Message(404, "Some nicknames do not exist.", EventErrorCodes.UnknownNickNames)
            {
                Details = new Dictionary<string, object> { ["nickNames"] = unknown },
            });
        }

        var now = DateTime.UtcNow;
        var sent = await _invitationRepository.CountInvitedSinceAsync(loaded.Value.ViewerId, now - _limits.InvitedPerDayWindow, ctoken);

        if (!sent.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while counting your invitations."));

        var invited = await _invitationRepository.InviteAsync(
            e.Id,
            loaded.Value.ViewerId,
            found.Value.Select(u => u.UserId).ToList(),
            Math.Max(0, _limits.InvitedPerDay - sent.Value),
            now,
            _limits.InvitedPerDayWindow,
            ctoken);

        if (invited.Status == RepositoryResultStatus.Conflict)
            return Result.Fail(new Message(429, $"You can invite at most {_limits.InvitedPerDay} people a day.", EventErrorCodes.TooManyInvites));

        if (invited.Status == RepositoryResultStatus.NotFound)
            return Result.Fail(await ClosedSinceAsync(userIdentifier, identifier, ctoken));

        if (!invited.IsSuccess || invited.Value is null)
            return Result.Fail(new Message(500, "An error occurred while sending the invitations."));

        if (invited.Value.NotifyUserIds.Count > 0)
            _pushQueue.Enqueue(EventPushes.Invited(e.Identifier, e.Title, invited.Value.InviterNickName, invited.Value.NotifyUserIds, loaded.Value.ViewerId));

        return Result.Ok();
    }

    // The event was cancelled, ended or reported between the check and the save; reloading names which. keep-comment: mirrors NoSpotTakenAsync for join
    private async Task<Message> ClosedSinceAsync(string userIdentifier, string identifier, CancellationToken ctoken)
    {
        var reloaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (reloaded.Message is not null || reloaded.Value is null)
            return reloaded.Message ?? EventErrors.Gone();

        return reloaded.Value.Membership.InviteRefusal() ?? EventErrors.NotAllowed();
    }

    public async Task<Result<IReadOnlyList<EventInvitationResponse>>> GetPendingAsync(string userIdentifier, CancellationToken ctoken)
    {
        var viewer = await _loader.ResolveUserAsync(userIdentifier, ctoken);

        if (viewer.Message is not null)
            return Result.Fail<IReadOnlyList<EventInvitationResponse>>(viewer.Message);

        var hidden = await _userBlockService.GetHiddenUserIdsForReadAsync(viewer.Value, ctoken);
        var pending = await _invitationRepository.GetPendingForUserAsync(viewer.Value, hidden, DateTime.UtcNow, MaxPendingListed, ctoken);

        if (!pending.IsSuccess || pending.Value is null)
            return Result.Fail<IReadOnlyList<EventInvitationResponse>>(new Message(500, "An error occurred while fetching your invitations."));

        IReadOnlyList<EventInvitationResponse> response = pending.Value
            .Select(i => new EventInvitationResponse
            {
                Event = _factory.CreateSummary(i.Event, distanceMeters: null),
                InvitedByNickName = i.InvitedByUserId is int inviterId && hidden.Contains(inviterId) ? null : i.InvitedByNickName,
                InvitedAt = i.InvitedAt,
            })
            .ToList();

        return Result.Ok(response);
    }

    // Any 404 means the invitation is out of reach: revoked, the event deleted, or a cancel that took the invitation with it. keep-comment: stale-state table, one answer for all three
    public async Task<Result> AcceptAsync(string userIdentifier, string identifier, CancellationToken ctoken)
    {
        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message?.StatusCode == 404)
            return Result.Fail(EventErrors.InvitationGone());

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail(loaded.Message ?? EventErrors.InvitationGone());

        if (loaded.Value.Membership.ParticipantStatus == EventParticipantStatus.Joined)
            return Result.Ok();

        var refusal = loaded.Value.Membership.AcceptRefusal();

        if (refusal is not null)
            return Result.Fail(refusal);

        var accepted = await _participantRepository.AcceptInvitationAsync(loaded.Value.Detail.Event.Id, loaded.Value.ViewerId, DateTime.UtcNow, ctoken);

        return accepted.Status switch
        {
            RepositoryResultStatus.Success => Result.Ok(),
            RepositoryResultStatus.Conflict => await NotAcceptedAsync(userIdentifier, identifier, ctoken),
            RepositoryResultStatus.NotFound => Result.Fail(new Message(409, "You cannot join this event.", EventErrorCodes.RemovedFromEvent)),
            _ => Result.Fail(new Message(500, "An error occurred while accepting the invitation.")),
        };
    }

    private async Task<Result> NotAcceptedAsync(string userIdentifier, string identifier, CancellationToken ctoken)
    {
        var reloaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (reloaded.Message is not null || reloaded.Value is null)
            return Result.Fail(EventErrors.InvitationGone());

        if (reloaded.Value.Membership.ParticipantStatus == EventParticipantStatus.Joined)
            return Result.Ok();

        return Result.Fail(reloaded.Value.Membership.AcceptRefusal() ?? new Message(409, "The event is full.", EventErrorCodes.EventFull));
    }

    // Undo actions answer 204 when the event or the invitation is already gone. keep-comment: stale-state rule
    public async Task<Result> DeclineAsync(string userIdentifier, string identifier, CancellationToken ctoken)
    {
        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message?.StatusCode == 404)
            return Result.Ok();

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail(loaded.Message ?? EventErrors.Gone());

        var declined = await _invitationRepository.DeclineAsync(loaded.Value.Detail.Event.Id, loaded.Value.ViewerId, ctoken);

        return declined.IsSuccess
            ? Result.Ok()
            : Result.Fail(new Message(500, "An error occurred while declining the invitation."));
    }

    public async Task<Result> RevokeAsync(string userIdentifier, string identifier, string inviteeIdentifier, CancellationToken ctoken)
    {
        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message?.StatusCode == 404)
            return Result.Ok();

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail(loaded.Message ?? EventErrors.Gone());

        var eventId = loaded.Value.Detail.Event.Id;
        var row = await _invitationRepository.GetPendingAsync(eventId, inviteeIdentifier, ctoken);

        if (row.Status == RepositoryResultStatus.NotFound)
            return Result.Ok();

        if (!row.IsSuccess || row.Value is null)
            return Result.Fail(new Message(500, "An error occurred while fetching the invitation."));

        if (!loaded.Value.Membership.CanRevokeInvitation(row.Value.InvitedByUserId == loaded.Value.ViewerId))
            return Result.Fail(EventErrors.NotAllowed());

        var revoked = await _invitationRepository.RevokeAsync(eventId, row.Value.InvitedUserId, ctoken);

        return revoked.IsSuccess
            ? Result.Ok()
            : Result.Fail(new Message(500, "An error occurred while revoking the invitation."));
    }
}
