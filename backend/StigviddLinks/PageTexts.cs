// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Globalization;

namespace StigviddLinks;

public record PageTexts
{
    public required string Code { get; init; }
    public required string OgLocale { get; init; }
    public required CultureInfo Culture { get; init; }
    public required string SwitchToLabel { get; init; }
    public required string SwitchToCode { get; init; }
    public required string OpenInApp { get; init; }
    public required string AppStore { get; init; }
    public required string GooglePlay { get; init; }
    public required string GetTheAppHint { get; init; }
    public required string AndroidTest { get; init; }
    public required string AndroidTestHint { get; init; }
    public required string FallbackTrailName { get; init; }
    public required string ToSite { get; init; }
    public required string NotFoundHeading { get; init; }
    public required string NotFoundBody { get; init; }
    public required string ErrorHeading { get; init; }
    public required string ErrorBody { get; init; }
    public required string EventTimeFormat { get; init; }
    public required string JoinInApp { get; init; }
    public required string EventNotFoundHeading { get; init; }
    public required string EventNotFoundBody { get; init; }
    public required string EventErrorBody { get; init; }
    public required string ParticipantsFormat { get; init; }
    public required string ParticipantsOfMaxFormat { get; init; }

    public static readonly PageTexts Swedish = new()
    {
        Code = "sv",
        OgLocale = "sv_SE",
        Culture = CultureInfo.GetCultureInfo("sv-SE"),
        SwitchToLabel = "English",
        SwitchToCode = "en",
        OpenInApp = "Öppna i appen",
        AppStore = "Hämta i App Store",
        GooglePlay = "Hämta på Google Play",
        GetTheAppHint = "Har du inte Stigvidd? Hämta appen och öppna länken igen.",
        AndroidTest = "Testa på Android",
        AndroidTestHint = "Stigvidd finns snart på Google Play. Vill du testa redan nu? Hör av dig.",
        FallbackTrailName = "En led på Stigvidd",
        ToSite = "Till stigvidd.se",
        NotFoundHeading = "Leden finns inte",
        NotFoundBody = "Vi hittar ingen led med den här länken. Den kan ha tagits bort.",
        ErrorHeading = "Något gick fel",
        ErrorBody = "Vi kunde inte hämta leden just nu. Försök igen om en stund.",
        EventTimeFormat = "dddd d MMMM 'kl.' HH:mm",
        JoinInApp = "Öppna evenemanget i appen för att gå med.",
        EventNotFoundHeading = "Evenemanget finns inte",
        EventNotFoundBody = "Vi hittar inget öppet evenemang med den här länken. Det kan ha ställts in, redan ha varit eller vara privat.",
        EventErrorBody = "Vi kunde inte hämta evenemanget just nu. Försök igen om en stund.",
        ParticipantsFormat = "{0} deltar",
        ParticipantsOfMaxFormat = "{0} av {1} platser tagna",
    };

    public static readonly PageTexts English = new()
    {
        Code = "en",
        OgLocale = "en_GB",
        Culture = CultureInfo.GetCultureInfo("en-GB"),
        SwitchToLabel = "Svenska",
        SwitchToCode = "sv",
        OpenInApp = "Open in the app",
        AppStore = "Download on the App Store",
        GooglePlay = "Get it on Google Play",
        GetTheAppHint = "Don't have Stigvidd? Get the app and open the link again.",
        AndroidTest = "Try it on Android",
        AndroidTestHint = "Stigvidd is coming to Google Play soon. Want to try it now? Get in touch.",
        FallbackTrailName = "A trail on Stigvidd",
        ToSite = "Go to stigvidd.se",
        NotFoundHeading = "Trail not found",
        NotFoundBody = "We can't find a trail for this link. It may have been removed.",
        ErrorHeading = "Something went wrong",
        ErrorBody = "We couldn't load the trail right now. Please try again in a moment.",
        EventTimeFormat = "dddd d MMMM, HH:mm",
        JoinInApp = "Open the event in the app to join.",
        EventNotFoundHeading = "Event not found",
        EventNotFoundBody = "We can't find an open event for this link. It may have been cancelled, be over, or be private.",
        EventErrorBody = "We couldn't load the event right now. Please try again in a moment.",
        ParticipantsFormat = "{0} going",
        ParticipantsOfMaxFormat = "{0} of {1} spots taken",
    };

    // Swedish unless ?lang=en asks otherwise: link previews are fetched by crawlers whose Accept-Language is English. keep-comment: why the header is not used
    public static PageTexts For(string? lang)
    {
        return string.Equals(lang, English.Code, StringComparison.OrdinalIgnoreCase) ? English : Swedish;
    }
}
