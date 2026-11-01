// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Enums;

namespace Core.Services.Events;

// The caller's relation to one event, loaded in one query. Every rights decision about events is a method here. keep-comment: no role checks anywhere else
public sealed record EventMembership(
    EventVisibility Visibility,
    EventStatus Status,
    ModerationState ModerationState,
    bool IsPast,
    bool RegistrationClosed,
    bool AllowParticipantInvites,
    EventParticipantRole? Role,
    EventParticipantStatus? ParticipantStatus,
    bool HasPendingInvite)
{
    public static EventMembership Of(EventDetail detail, DateTime now)
    {
        var e = detail.Event;

        return new EventMembership(
            e.Visibility,
            e.Status,
            e.ModerationState,
            IsPast: e.PastAfter <= now,
            RegistrationClosed: e.RegistrationDeadline.HasValue && e.RegistrationDeadline.Value < now,
            e.AllowParticipantInvites,
            detail.MyRole,
            detail.MyStatus,
            detail.HasPendingInvite);
    }

    private bool IsJoined
    {
        get { return ParticipantStatus == EventParticipantStatus.Joined; }
    }

    private bool IsHost
    {
        get { return IsJoined && Role is EventParticipantRole.Organizer or EventParticipantRole.CoHost; }
    }

    private bool IsOrganizer
    {
        get { return IsJoined && Role == EventParticipantRole.Organizer; }
    }

    private bool IsOpenToNewcomers
    {
        get { return Status == EventStatus.Published && !IsPast && ModerationState == ModerationState.Visible; }
    }

    // False means 404, never 403: a private event must not be confirmed to someone outside it. keep-comment: the 404-not-403 rule lives here
    public bool CanView()
    {
        if (ParticipantStatus is EventParticipantStatus.Joined or EventParticipantStatus.Interested || HasPendingInvite)
            return true;

        return Visibility == EventVisibility.Open && ModerationState == ModerationState.Visible;
    }

    // A past or cancelled event is frozen except for delete and leave, so moving StartsAt cannot revive it. keep-comment: closes reuse of an old event past the per-day cap
    // A reported event is not edited until an admin has looked, so the report is judged on the text it was made about. keep-comment: as with reviews, which the query filter hides from their author
    public Message? EditRefusal()
    {
        if (ClosedRefusal() is Message closed)
            return closed;

        return IsHost && ModerationState == ModerationState.Visible ? null : EventErrors.NotAllowed();
    }

    public bool CanEdit()
    {
        return EditRefusal() is null;
    }

    public Message? CancelRefusal()
    {
        return ClosedRefusal() ?? (IsOrganizer ? null : EventErrors.NotAllowed());
    }

    public bool CanCancel()
    {
        return CancelRefusal() is null;
    }

    public bool CanDelete()
    {
        return IsOrganizer;
    }

    // Whether participants may invite is the organizer's call; a CoHost's edit keeps the stored value. keep-comment: rights table
    public bool CanToggleParticipantInvites()
    {
        return IsOrganizer;
    }

    public Message? RoleChangeRefusal()
    {
        return ClosedRefusal() ?? (IsOrganizer ? null : EventErrors.NotAllowed());
    }

    public bool CanChangeRoles()
    {
        return RoleChangeRefusal() is null;
    }

    public bool CanInvite()
    {
        return InviteRefusal() is null;
    }

    // An invitation that could not be accepted is refused up front, so the deadline counts too. keep-comment: why invite checks registration
    public Message? InviteRefusal()
    {
        if (ClosedRefusal() is Message closed)
            return closed;

        var mayInvite = IsJoined
            && ModerationState == ModerationState.Visible
            && (IsHost || AllowParticipantInvites);

        return mayInvite ? DeadlineRefusal() : EventErrors.NotAllowed();
    }

    // A reported event can still be joined by someone invited before the report. keep-comment: plan decision, why moderation is not checked
    public Message? AcceptRefusal()
    {
        if (!HasPendingInvite)
            return EventErrors.InvitationGone();

        return RegistrationRefusal();
    }

    // The inviter may take back their own invitation without being a host, also after leaving an open event. keep-comment: rights table
    public bool CanRevokeInvitation(bool isInviter)
    {
        return isInviter || IsHost;
    }

    public Message? RemoveRefusal(EventParticipantRole targetRole)
    {
        if (ClosedRefusal() is Message closed)
            return closed;

        var allowed = IsOrganizer
            ? targetRole != EventParticipantRole.Organizer
            : IsHost && targetRole == EventParticipantRole.Participant;

        return allowed ? null : EventErrors.NotAllowed();
    }

    public bool CanRemove(EventParticipantRole targetRole)
    {
        return RemoveRefusal(targetRole) is null;
    }

    public bool CanPinOrDeletePosts()
    {
        return IsHost;
    }

    public bool CanJoin()
    {
        return JoinRefusal() is null;
    }

    // Why a join is refused, with the code the app shows; a reported event answers like a gone one. keep-comment: never reveal a report
    public Message? JoinRefusal()
    {
        if (ModerationState != ModerationState.Visible && ParticipantStatus is null)
            return EventErrors.Gone();

        return ClosedRefusal() ?? AccessRefusal() ?? DeadlineRefusal();
    }

    // The event's own state only, not who is asking: the part an invitation's accept shares with join. keep-comment: accept skips the open-event and moderation checks
    public Message? RegistrationRefusal()
    {
        return ClosedRefusal() ?? DeadlineRefusal();
    }

    private Message? ClosedRefusal()
    {
        if (Status == EventStatus.Cancelled)
            return EventErrors.Cancelled();

        if (IsPast)
            return EventErrors.Past();

        return null;
    }

    private Message? AccessRefusal()
    {
        if (ParticipantStatus == EventParticipantStatus.Removed)
            return new Message(409, "You cannot join this event.", EventErrorCodes.RemovedFromEvent);

        if (ParticipantStatus == EventParticipantStatus.Joined)
            return new Message(409, "You have already joined.");

        if (Visibility != EventVisibility.Open || ModerationState != ModerationState.Visible)
            return EventErrors.NotAllowed();

        return null;
    }

    private Message? DeadlineRefusal()
    {
        return RegistrationClosed
            ? new Message(409, "Registration has closed.", EventErrorCodes.RegistrationClosed)
            : null;
    }

    // Takes no spot, so neither the deadline nor capacity matters. keep-comment: differs from CanJoin on purpose
    public bool CanMarkInterested()
    {
        return Visibility == EventVisibility.Open
            && IsOpenToNewcomers
            && ParticipantStatus is null or EventParticipantStatus.Interested;
    }

    public bool CanSeeParticipants()
    {
        return IsJoined;
    }

    // A host sees users they blocked in the list, so they can still remove them; the block is their own, so nothing leaks. keep-comment: why hosts skip the block filter
    public bool SeesBlockedParticipants()
    {
        return IsHost;
    }

    public bool CanReadBoard()
    {
        return IsJoined;
    }

    // The board stays open on a past, cancelled or reported event: it is the participants' own conversation. keep-comment: plan decision, the board keeps working
    public Message? PostRefusal()
    {
        if (IsJoined)
            return null;

        return ParticipantStatus == EventParticipantStatus.Removed
            ? new Message(403, "You have been removed from this event.", EventErrorCodes.RemovedFromEvent)
            : EventErrors.NotAllowed();
    }

    public bool CanPost()
    {
        return PostRefusal() is null;
    }
}
