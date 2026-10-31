// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using System.Globalization;

namespace Core.Services.Push;

public static class EventPushes
{
    private static readonly CultureInfo Swedish = CultureInfo.GetCultureInfo("sv-SE");

    // Never the reason; cancelledByUserId is null for account deletion and moderation, where no live person cancelled. keep-comment: plan decision
    public static PushMessage Cancelled(string eventIdentifier, string title, DateTime startsAtUtc, IReadOnlyCollection<int> userIds, int? cancelledByUserId)
    {
        return new PushMessage(
            userIds,
            $"Inställt: {title}",
            $"Evenemanget den {SwedishDate(startsAtUtc)} är inställt.",
            new Dictionary<string, object>
            {
                ["type"] = PushTypes.EventCancelled,
                ["eventIdentifier"] = eventIdentifier,
            },
            cancelledByUserId);
    }

    // The successor of an upcoming event hears they took over; on a cancel no one caused, the push carries no sender. keep-comment: the departed organizer may have asked to be forgotten
    public static IReadOnlyList<PushMessage> ForHandOver(HandOverOutcome outcome)
    {
        var pushes = new List<PushMessage>();

        if (outcome.WasUpcoming && outcome.NewOrganizerUserId is int newOrganizerUserId)
            pushes.Add(Promoted(outcome.EventIdentifier, outcome.Title, newOrganizerUserId));

        if (outcome.CancelNotifyUserIds.Count > 0)
            pushes.Add(Cancelled(outcome.EventIdentifier, outcome.Title, outcome.StartsAt, outcome.CancelNotifyUserIds, cancelledByUserId: null));

        return pushes;
    }

    public static PushMessage Promoted(string eventIdentifier, string title, int userId)
    {
        return new PushMessage(
            [userId],
            $"Du är nu arrangör: {title}",
            "Du har tagit över som arrangör för evenemanget.",
            new Dictionary<string, object>
            {
                ["type"] = PushTypes.EventPromoted,
                ["eventIdentifier"] = eventIdentifier,
            });
    }

    public static PushMessage PromotedToCoHost(string eventIdentifier, string title, int userId, int promotedByUserId)
    {
        return new PushMessage(
            [userId],
            $"Du är nu medarrangör: {title}",
            "Du kan nu redigera evenemanget och bjuda in fler.",
            new Dictionary<string, object>
            {
                ["type"] = PushTypes.EventPromoted,
                ["eventIdentifier"] = eventIdentifier,
            },
            promotedByUserId);
    }

    public static PushMessage Invited(string eventIdentifier, string title, string inviterNickName, IReadOnlyCollection<int> userIds, int inviterUserId)
    {
        return new PushMessage(
            userIds,
            "Ny inbjudan",
            $"{inviterNickName} bjöd in dig till {title}",
            new Dictionary<string, object>
            {
                ["type"] = PushTypes.EventInvite,
                ["eventIdentifier"] = eventIdentifier,
            },
            inviterUserId);
    }

    public static string SwedishDate(DateTime utc)
    {
        return ToStockholm(utc).ToString("d MMMM", Swedish);
    }

    private static DateTime ToStockholm(DateTime utc)
    {
        try
        {
            var zone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Stockholm");
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), zone);
        }
        catch (TimeZoneNotFoundException)
        {
            return utc;
        }
    }
}
