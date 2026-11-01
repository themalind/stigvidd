// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace StigviddLinks;

public static class EventTime
{
    // Events are stored in UTC and happen in Sweden. keep-comment: a crawler's or visitor's zone says nothing about the meet-up
    public static DateTime Stockholm(DateTime utc)
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
