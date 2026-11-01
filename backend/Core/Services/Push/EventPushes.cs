// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using System.Globalization;

namespace Core.Services.Push;

// StartsAt is the new start when it moved, else null. keep-comment: an empty change sends no push
public sealed record EventChange(DateTime? StartsAt, bool EndsAt, bool Place)
{
    public bool Any()
    {
        return StartsAt is not null || EndsAt || Place;
    }
}

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

    public static PushMessage Updated(string eventIdentifier, string title, EventChange change, IReadOnlyCollection<int> userIds, int editedByUserId)
    {
        var parts = new List<string>();

        if (change.StartsAt is DateTime startsAt)
            parts.Add($"ny starttid {SwedishDateTime(startsAt)}");
        else if (change.EndsAt)
            parts.Add("ny sluttid");

        if (change.Place)
            parts.Add("ny mötesplats");

        var text = string.Join(" och ", parts);

        return new PushMessage(
            userIds,
            $"Ändrat: {title}",
            $"{char.ToUpper(text[0], Swedish)}{text[1..]}.",
            new Dictionary<string, object>
            {
                ["type"] = PushTypes.EventUpdated,
                ["eventIdentifier"] = eventIdentifier,
            },
            editedByUserId);
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

    public const int PostSnippetLength = 80;

    public static PushMessage Post(string eventIdentifier, string title, string authorNickName, string body, IReadOnlyCollection<int> userIds, int authorUserId)
    {
        var text = body.Trim().ReplaceLineEndings(" ");
        var cut = PostSnippetLength;

        // Never between the two halves of an emoji. keep-comment: a lone surrogate turns into a replacement character
        if (text.Length > cut && char.IsHighSurrogate(text[cut - 1]))
            cut--;

        var snippet = text.Length > PostSnippetLength ? $"{text[..cut].TrimEnd()}…" : text;

        return new PushMessage(
            userIds,
            title,
            $"{authorNickName}: {snippet}",
            new Dictionary<string, object>
            {
                ["type"] = PushTypes.EventPost,
                ["eventIdentifier"] = eventIdentifier,
            },
            authorUserId);
    }

    public static string SwedishDate(DateTime utc)
    {
        return ToStockholm(utc).ToString("d MMMM", Swedish);
    }

    public static string SwedishDateTime(DateTime utc)
    {
        return ToStockholm(utc).ToString("d MMMM 'kl.' HH:mm", Swedish);
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
