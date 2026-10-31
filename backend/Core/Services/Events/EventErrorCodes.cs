// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Services.Events;

// The app maps each value to its own copy; renaming one breaks installed apps. keep-comment: contract with shipped clients
public static class EventErrorCodes
{
    public const string EventGone = "event_gone";
    public const string EventCancelled = "event_cancelled";
    public const string EventPast = "event_past";
    public const string RegistrationClosed = "registration_closed";
    public const string EventFull = "event_full";
    public const string InvitationGone = "invitation_gone";
    public const string RemovedFromEvent = "removed_from_event";
    public const string NotAllowed = "not_allowed";
    public const string OrganizerBlocked = "organizer_blocked";
    public const string TooManyUpcoming = "too_many_upcoming";
    public const string TooManyToday = "too_many_today";
    public const string TooManyInvites = "too_many_invites";
    public const string UnknownNickNames = "unknown_nicknames";
}
