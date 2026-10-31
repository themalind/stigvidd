// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Services;

// Npgsql refuses a DateTime whose Kind is not Utc against timestamptz; SQLite takes any Kind, so the tests stay green while production answers 500. keep-comment: why every incoming date goes through here
// Unspecified is read as UTC; Local (an offset in the JSON) is converted. keep-comment: the rule for each Kind
public static class UtcDates
{
    public static DateTime ToUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
        };
    }

    public static DateTime? ToUtc(DateTime? value)
    {
        return value.HasValue ? ToUtc(value.Value) : null;
    }
}
