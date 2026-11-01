// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services.Events;
using Infrastructure.Enums;

namespace UnitTests.ServiceTests;

public class EventMembershipTests
{
    private const EventParticipantRole Organizer = EventParticipantRole.Organizer;
    private const EventParticipantRole CoHost = EventParticipantRole.CoHost;
    private const EventParticipantRole Participant = EventParticipantRole.Participant;

    private static EventMembership Joined(EventParticipantRole role, bool allowParticipantInvites = false)
    {
        return new EventMembership(
            EventVisibility.Open, EventStatus.Published, ModerationState.Visible,
            IsPast: false, RegistrationClosed: false, allowParticipantInvites,
            role, EventParticipantStatus.Joined, HasPendingInvite: false);
    }

    private static EventMembership Outsider(
        EventVisibility visibility = EventVisibility.Open,
        EventStatus status = EventStatus.Published,
        ModerationState moderation = ModerationState.Visible,
        bool isPast = false,
        bool registrationClosed = false,
        EventParticipantStatus? participantStatus = null,
        bool hasPendingInvite = false)
    {
        return new EventMembership(
            visibility, status, moderation, isPast, registrationClosed, AllowParticipantInvites: false,
            participantStatus is null ? null : Participant, participantStatus, hasPendingInvite);
    }

    public static TheoryData<string, EventParticipantRole, bool> RightsTable()
    {
        return new TheoryData<string, EventParticipantRole, bool>
        {
            { "edit", Organizer, true }, { "edit", CoHost, true }, { "edit", Participant, false },
            { "invite", Organizer, true }, { "invite", CoHost, true }, { "invite", Participant, false },
            { "remove participant", Organizer, true }, { "remove participant", CoHost, true }, { "remove participant", Participant, false },
            { "remove cohost", Organizer, true }, { "remove cohost", CoHost, false }, { "remove cohost", Participant, false },
            { "remove organizer", Organizer, false }, { "remove organizer", CoHost, false }, { "remove organizer", Participant, false },
            { "pin or delete posts", Organizer, true }, { "pin or delete posts", CoHost, true }, { "pin or delete posts", Participant, false },
            { "cancel", Organizer, true }, { "cancel", CoHost, false }, { "cancel", Participant, false },
            { "delete", Organizer, true }, { "delete", CoHost, false }, { "delete", Participant, false },
            { "change roles", Organizer, true }, { "change roles", CoHost, false }, { "change roles", Participant, false },
            { "toggle participant invites", Organizer, true }, { "toggle participant invites", CoHost, false }, { "toggle participant invites", Participant, false },
            { "read board", Organizer, true }, { "read board", CoHost, true }, { "read board", Participant, true },
            { "post", Organizer, true }, { "post", CoHost, true }, { "post", Participant, true },
            { "view", Organizer, true }, { "view", CoHost, true }, { "view", Participant, true },
        };
    }

    private static bool Right(EventMembership membership, string right)
    {
        return right switch
        {
            "edit" => membership.CanEdit(),
            "invite" => membership.CanInvite(),
            "remove participant" => membership.CanRemove(Participant),
            "remove cohost" => membership.CanRemove(CoHost),
            "remove organizer" => membership.CanRemove(Organizer),
            "pin or delete posts" => membership.CanPinOrDeletePosts(),
            "cancel" => membership.CanCancel(),
            "delete" => membership.CanDelete(),
            "change roles" => membership.CanChangeRoles(),
            "toggle participant invites" => membership.CanToggleParticipantInvites(),
            "read board" => membership.CanReadBoard(),
            "post" => membership.CanPost(),
            "view" => membership.CanView(),
            _ => throw new ArgumentOutOfRangeException(nameof(right), right, null),
        };
    }

    [Theory]
    [MemberData(nameof(RightsTable))]
    public void TheRightsTable(string right, EventParticipantRole role, bool expected)
    {
        Right(Joined(role), right).Should().Be(expected);
    }

    [Fact]
    public void AParticipantMayInvite_OnlyWhenTheOrganizerAllowsIt()
    {
        Joined(Participant, allowParticipantInvites: true).CanInvite().Should().BeTrue();
    }

    [Fact]
    public void ACancelledEvent_CanNoLongerBeEditedCancelledOrReRoled_ButCanBeDeleted()
    {
        var membership = Joined(Organizer) with { Status = EventStatus.Cancelled };

        membership.CanEdit().Should().BeFalse();
        membership.CanCancel().Should().BeFalse();
        membership.CanChangeRoles().Should().BeFalse();
        membership.CanRemove(Participant).Should().BeFalse();
        membership.CanDelete().Should().BeTrue();
    }

    [Fact]
    public void APastEvent_CanNoLongerBeCancelledOrHaveParticipantsRemoved_ButCanBeDeleted()
    {
        var membership = Joined(Organizer) with { IsPast = true };

        membership.CanCancel().Should().BeFalse();
        membership.CanRemove(Participant).Should().BeFalse();
        CodeOf(membership.RemoveRefusal(Participant)).Should().Be(EventErrorCodes.EventPast);
        membership.CanDelete().Should().BeTrue();
    }

    [Fact]
    public void AReportedEvent_IsNotEditedUntilAnAdminHasLooked()
    {
        var membership = Joined(CoHost) with { ModerationState = ModerationState.HiddenPendingReview };

        membership.CanEdit().Should().BeFalse();
        CodeOf(membership.EditRefusal()).Should().Be(EventErrorCodes.NotAllowed);
    }

    [Fact]
    public void FrozenRefusals_NameCancelledBeforePast()
    {
        var membership = Joined(Organizer) with { Status = EventStatus.Cancelled, IsPast = true };

        CodeOf(membership.EditRefusal()).Should().Be(EventErrorCodes.EventCancelled);
        CodeOf(membership.CancelRefusal()).Should().Be(EventErrorCodes.EventCancelled);
        CodeOf(membership.RoleChangeRefusal()).Should().Be(EventErrorCodes.EventCancelled);
        CodeOf(membership.RemoveRefusal(Participant)).Should().Be(EventErrorCodes.EventCancelled);
    }

    private static string? CodeOf(Message? refusal)
    {
        refusal.Should().NotBeNull();
        return refusal.Code;
    }

    [Fact]
    public void AnEventWithNoOrganizerRow_GrantsNoHostRights()
    {
        var membership = Outsider(status: EventStatus.Cancelled);

        membership.CanEdit().Should().BeFalse();
        membership.CanCancel().Should().BeFalse();
        membership.CanDelete().Should().BeFalse();
        membership.CanRemove(Participant).Should().BeFalse();
    }

    public static TheoryData<string, EventMembership, bool> Viewing()
    {
        return new TheoryData<string, EventMembership, bool>
        {
            { "an open event to an outsider", Outsider(), true },
            { "a private event to an outsider", Outsider(visibility: EventVisibility.Private), false },
            { "a private event to a pending invitee", Outsider(visibility: EventVisibility.Private, hasPendingInvite: true), true },
            { "a private event to someone removed from it", Outsider(visibility: EventVisibility.Private, participantStatus: EventParticipantStatus.Removed), false },
            { "a reported open event to an outsider", Outsider(moderation: ModerationState.HiddenPendingReview), false },
            { "a reported open event to someone interested", Outsider(moderation: ModerationState.HiddenPendingReview, participantStatus: EventParticipantStatus.Interested), true },
            { "a reported event to a pending invitee", Outsider(moderation: ModerationState.HiddenPendingReview, hasPendingInvite: true), true },
        };
    }

    [Theory]
    [MemberData(nameof(Viewing))]
    public void CanView(string because, EventMembership membership, bool expected)
    {
        membership.CanView().Should().Be(expected, because);
    }

    public static TheoryData<string, EventMembership, bool> Joining()
    {
        return new TheoryData<string, EventMembership, bool>
        {
            { "an open event", Outsider(), true },
            { "an open event you are interested in", Outsider(participantStatus: EventParticipantStatus.Interested), true },
            { "an event you already joined", Outsider(participantStatus: EventParticipantStatus.Joined), false },
            { "an event you were removed from", Outsider(participantStatus: EventParticipantStatus.Removed), false },
            { "a private event", Outsider(visibility: EventVisibility.Private), false },
            { "a cancelled event", Outsider(status: EventStatus.Cancelled), false },
            { "a past event", Outsider(isPast: true), false },
            { "an event past its deadline", Outsider(registrationClosed: true), false },
            { "a reported event", Outsider(moderation: ModerationState.HiddenPendingReview), false },
        };
    }

    [Theory]
    [MemberData(nameof(Joining))]
    public void CanJoin(string because, EventMembership membership, bool expected)
    {
        membership.CanJoin().Should().Be(expected, because);
    }

    public static TheoryData<string, EventMembership, int, string?> JoinRefusals()
    {
        return new TheoryData<string, EventMembership, int, string?>
        {
            { "a reported event, to an outsider", Outsider(moderation: ModerationState.HiddenPendingReview), 404, EventErrorCodes.EventGone },
            { "a cancelled event", Outsider(status: EventStatus.Cancelled), 409, EventErrorCodes.EventCancelled },
            { "a past event", Outsider(isPast: true), 409, EventErrorCodes.EventPast },
            { "an event you were removed from", Outsider(participantStatus: EventParticipantStatus.Removed), 409, EventErrorCodes.RemovedFromEvent },
            { "a private event you were invited to", Outsider(visibility: EventVisibility.Private, hasPendingInvite: true), 403, EventErrorCodes.NotAllowed },
            { "a reported event you are interested in", Outsider(moderation: ModerationState.HiddenPendingReview, participantStatus: EventParticipantStatus.Interested), 403, EventErrorCodes.NotAllowed },
            { "an event past its deadline", Outsider(registrationClosed: true), 409, EventErrorCodes.RegistrationClosed },
        };
    }

    [Theory]
    [MemberData(nameof(JoinRefusals))]
    public void JoinRefusal_NamesTheReason(string because, EventMembership membership, int status, string? code)
    {
        var refusal = membership.JoinRefusal();

        refusal.Should().NotBeNull(because);
        refusal.StatusCode.Should().Be(status, because);
        refusal.Code.Should().Be(code, because);
    }

    public static TheoryData<string, EventMembership, string?> RegistrationRefusals()
    {
        return new TheoryData<string, EventMembership, string?>
        {
            { "an open, upcoming event", Outsider(), null },
            { "a private event you were invited to", Outsider(visibility: EventVisibility.Private, hasPendingInvite: true), null },
            { "a reported event you were invited to", Outsider(visibility: EventVisibility.Private, moderation: ModerationState.HiddenPendingReview, hasPendingInvite: true), null },
            { "a cancelled event", Outsider(visibility: EventVisibility.Private, status: EventStatus.Cancelled, hasPendingInvite: true), EventErrorCodes.EventCancelled },
            { "a past event", Outsider(visibility: EventVisibility.Private, isPast: true, hasPendingInvite: true), EventErrorCodes.EventPast },
            { "an event past its deadline", Outsider(visibility: EventVisibility.Private, registrationClosed: true, hasPendingInvite: true), EventErrorCodes.RegistrationClosed },
        };
    }

    [Theory]
    [MemberData(nameof(RegistrationRefusals))]
    public void RegistrationRefusal_LooksOnlyAtTheEventsOwnState(string because, EventMembership membership, string? code)
    {
        var refusal = membership.RegistrationRefusal();

        refusal?.Code.Should().Be(code, because);
        (refusal is null).Should().Be(code is null, because);
    }

    public static TheoryData<string, EventMembership, bool> Interest()
    {
        return new TheoryData<string, EventMembership, bool>
        {
            { "an open event", Outsider(), true },
            { "an open event past its deadline", Outsider(registrationClosed: true), true },
            { "an event you are already interested in", Outsider(participantStatus: EventParticipantStatus.Interested), true },
            { "an event you joined", Outsider(participantStatus: EventParticipantStatus.Joined), false },
            { "an event you were removed from", Outsider(participantStatus: EventParticipantStatus.Removed), false },
            { "a private event", Outsider(visibility: EventVisibility.Private, hasPendingInvite: true), false },
            { "a cancelled event", Outsider(status: EventStatus.Cancelled), false },
            { "a past event", Outsider(isPast: true), false },
            { "a reported event", Outsider(moderation: ModerationState.HiddenPendingReview), false },
        };
    }

    [Theory]
    [MemberData(nameof(Interest))]
    public void CanMarkInterested(string because, EventMembership membership, bool expected)
    {
        membership.CanMarkInterested().Should().Be(expected, because);
    }

    [Fact]
    public void OnlyJoinedParticipantsSeeTheList()
    {
        Joined(Participant).CanSeeParticipants().Should().BeTrue();
        Outsider(participantStatus: EventParticipantStatus.Interested).CanSeeParticipants().Should().BeFalse();
        Outsider(hasPendingInvite: true).CanSeeParticipants().Should().BeFalse();
    }

    public static TheoryData<string, EventMembership, int?, string?> InviteRefusals()
    {
        return new TheoryData<string, EventMembership, int?, string?>
        {
            { "a host", Joined(CoHost), null, null },
            { "a participant when participants may invite", Joined(Participant, allowParticipantInvites: true), null, null },
            { "a participant otherwise", Joined(Participant), 403, EventErrorCodes.NotAllowed },
            { "an outsider", Outsider(), 403, EventErrorCodes.NotAllowed },
            { "an invitee who has not answered", Outsider(visibility: EventVisibility.Private, hasPendingInvite: true), 403, EventErrorCodes.NotAllowed },
            { "a reported event", Joined(Organizer) with { ModerationState = ModerationState.HiddenPendingReview }, 403, EventErrorCodes.NotAllowed },
            { "a cancelled event", Joined(Organizer) with { Status = EventStatus.Cancelled }, 409, EventErrorCodes.EventCancelled },
            { "a past event", Joined(Organizer) with { IsPast = true }, 409, EventErrorCodes.EventPast },
            { "an event past its deadline", Joined(Organizer) with { RegistrationClosed = true }, 409, EventErrorCodes.RegistrationClosed },
        };
    }

    [Theory]
    [MemberData(nameof(InviteRefusals))]
    public void InviteRefusal_NamesTheReason(string because, EventMembership membership, int? status, string? code)
    {
        var refusal = membership.InviteRefusal();

        refusal?.StatusCode.Should().Be(status, because);
        refusal?.Code.Should().Be(code, because);
        (refusal is null).Should().Be(status is null, because);
        membership.CanInvite().Should().Be(status is null, because);
    }

    public static TheoryData<string, EventMembership, int?, string?> AcceptRefusals()
    {
        return new TheoryData<string, EventMembership, int?, string?>
        {
            { "a pending invitation", Outsider(visibility: EventVisibility.Private, hasPendingInvite: true), null, null },
            { "a pending invitation to a reported event", Outsider(visibility: EventVisibility.Private, moderation: ModerationState.HiddenPendingReview, hasPendingInvite: true), null, null },
            { "no invitation", Outsider(), 404, EventErrorCodes.InvitationGone },
            { "a cancelled event", Outsider(visibility: EventVisibility.Private, status: EventStatus.Cancelled, hasPendingInvite: true), 409, EventErrorCodes.EventCancelled },
            { "an event past its deadline", Outsider(visibility: EventVisibility.Private, registrationClosed: true, hasPendingInvite: true), 409, EventErrorCodes.RegistrationClosed },
        };
    }

    [Theory]
    [MemberData(nameof(AcceptRefusals))]
    public void AcceptRefusal_NamesTheReason(string because, EventMembership membership, int? status, string? code)
    {
        var refusal = membership.AcceptRefusal();

        refusal?.StatusCode.Should().Be(status, because);
        refusal?.Code.Should().Be(code, because);
        (refusal is null).Should().Be(status is null, because);
    }

    [Theory]
    [InlineData(Organizer, false, true)]
    [InlineData(CoHost, false, true)]
    [InlineData(Participant, false, false)]
    [InlineData(Participant, true, true)]
    public void CanRevokeInvitation_HostsAndTheInviter(EventParticipantRole role, bool isInviter, bool expected)
    {
        Joined(role).CanRevokeInvitation(isInviter).Should().Be(expected);
    }

    [Fact]
    public void TheInviterRevokesEvenAfterLeaving()
    {
        Outsider().CanRevokeInvitation(isInviter: true).Should().BeTrue();
        Outsider().CanRevokeInvitation(isInviter: false).Should().BeFalse();
    }

    [Fact]
    public void NobodyInvitesToAReportedEvent()
    {
        (Joined(Organizer) with { ModerationState = ModerationState.HiddenPendingReview }).CanInvite().Should().BeFalse();
    }

    public static TheoryData<string, EventMembership, int?, string?> PostRefusals()
    {
        return new TheoryData<string, EventMembership, int?, string?>
        {
            { "a participant", Joined(Participant), null, null },
            { "a participant of a past event", Joined(Participant) with { IsPast = true }, null, null },
            { "a participant of a cancelled event", Joined(Participant) with { Status = EventStatus.Cancelled }, null, null },
            { "a participant of a reported event", Joined(Participant) with { ModerationState = ModerationState.HiddenPendingReview }, null, null },
            { "an interested user", Outsider(participantStatus: EventParticipantStatus.Interested), 403, EventErrorCodes.NotAllowed },
            { "an invitee", Outsider(visibility: EventVisibility.Private, hasPendingInvite: true), 403, EventErrorCodes.NotAllowed },
            { "a removed participant", Outsider(participantStatus: EventParticipantStatus.Removed), 403, EventErrorCodes.RemovedFromEvent },
        };
    }

    [Theory]
    [MemberData(nameof(PostRefusals))]
    public void PostRefusal_NamesTheReason(string because, EventMembership membership, int? status, string? code)
    {
        var refusal = membership.PostRefusal();

        refusal?.StatusCode.Should().Be(status, because);
        refusal?.Code.Should().Be(code, because);
        (refusal is null).Should().Be(status is null, because);
        membership.CanPost().Should().Be(status is null, because);
    }

    [Fact]
    public void ARemovedParticipant_HasNoParticipantRights()
    {
        var membership = Joined(CoHost) with { ParticipantStatus = EventParticipantStatus.Removed };

        membership.CanEdit().Should().BeFalse();
        membership.CanPost().Should().BeFalse();
        membership.CanReadBoard().Should().BeFalse();
        membership.CanInvite().Should().BeFalse();
    }
}
