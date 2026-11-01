// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using System.Globalization;
using System.Text;

namespace Core.Services.Events;

public static class EventCursor
{
    public static string Encode(EventPageKey key)
    {
        var raw = string.Create(CultureInfo.InvariantCulture, $"{key.At.Ticks}:{key.Id}");
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(raw));
    }

    public static bool TryDecode(string? cursor, out EventPageKey? key)
    {
        key = null;

        if (string.IsNullOrEmpty(cursor))
            return true;

        try
        {
            var parts = Encoding.UTF8.GetString(Convert.FromBase64String(cursor)).Split(':');

            if (parts.Length != 2
                || !long.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var ticks)
                || !int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var id)
                || ticks > DateTime.MaxValue.Ticks)
                return false;

            key = new EventPageKey(new DateTime(ticks, DateTimeKind.Utc), id);
            return true;
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
