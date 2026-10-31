// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using System.Linq.Expressions;

namespace Core.Repositories.Events;

public static class EventQueries
{
    // Who may find an event, as EventMembership.CanView: open, or joined, interested or invited; a Removed row is not inside. keep-comment: the two rules must match
    public static Expression<Func<Event, bool>> FindableBy(int userId)
    {
        return e => e.Visibility == EventVisibility.Open
            || e.Participants.Any(p => p.UserId == userId
                && (p.Status == EventParticipantStatus.Joined || p.Status == EventParticipantStatus.Interested))
            || e.Invitations.Any(i => i.InvitedUserId == userId && i.Status == EventInvitationStatus.Pending);
    }

    public static Expression<Func<Event, bool>> OrganizerNotHidden(int[] hiddenUserIds)
    {
        return e => !e.Participants.Any(p => p.Role == EventParticipantRole.Organizer && hiddenUserIds.Contains(p.UserId));
    }

    public static Expression<Func<Event, EventCard>> Card(int viewerId, int[] hiddenUserIds)
    {
        return e => new EventCard(
            e.Id,
            e.Identifier,
            e.Title,
            e.StartsAt,
            e.EndsAt,
            e.LocationName,
            e.MeetingPointName,
            e.Trail == null ? null : e.Trail.Name,
            e.Trail == null ? null : e.Trail.TrailLength,
            e.Route == null ? null : e.Route.LengthMetres,
            e.Visibility,
            e.Status,
            e.ParticipantCount,
            e.MaxParticipants,
            e.Image == null ? null : e.Image.ImageUrl,
            e.Image == null ? null : e.Image.ModerationState,
            e.Participants.Where(p => p.Role == EventParticipantRole.Organizer).Select(p => p.User == null ? null : p.User.NickName).FirstOrDefault(),
            e.Location.X,
            e.Location.Y,
            e.Participants.Where(p => p.UserId == viewerId).Select(p => (EventParticipantRole?)p.Role).FirstOrDefault(),
            e.Participants.Where(p => p.UserId == viewerId).Select(p => (EventParticipantStatus?)p.Status).FirstOrDefault(),
            e.Participants
                .Where(p => p.UserId == viewerId && p.Status == EventParticipantStatus.Joined)
                .Select(p => e.Posts.Count(post =>
                    post.UserId != viewerId
                    && (post.UserId == null || !hiddenUserIds.Contains(post.UserId.Value))
                    && (p.LastReadPostAt == null || post.CreatedAt > p.LastReadPostAt)))
                .FirstOrDefault());
    }
}
