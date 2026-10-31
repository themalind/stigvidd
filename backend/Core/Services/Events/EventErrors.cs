// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Services.Events;

// The answers every event action shares, so the rules and the services word them alike. keep-comment: depended on by EventMembership, not the other way round
public static class EventErrors
{
    public static Message Gone()
    {
        return new Message(404, "Event not found.", EventErrorCodes.EventGone);
    }

    public static Message Cancelled()
    {
        return new Message(409, "The event is cancelled.", EventErrorCodes.EventCancelled);
    }

    public static Message Past()
    {
        return new Message(409, "The event has already happened.", EventErrorCodes.EventPast);
    }

    public static Message InvitationGone()
    {
        return new Message(404, "The invitation is no longer valid.", EventErrorCodes.InvitationGone);
    }

    public static Message NotAllowed()
    {
        return new Message(403, "You are not allowed to do that.", EventErrorCodes.NotAllowed);
    }
}
