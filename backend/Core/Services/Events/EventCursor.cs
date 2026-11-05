// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using System.Globalization;
using System.Text;

namespace Core.Services.Events;

public static class EventCursor
{
    private const string DistancePrefix = "d";

    public static string Encode(EventPageKey key)
    {
        return Pack(string.Create(CultureInfo.InvariantCulture, $"{key.At.Ticks}:{key.Id}"));
    }

    // "R" round-trips the double exactly, so the next page compares against the same value. keep-comment: why not a shorter format
    public static string EncodeDistance(EventDistanceKey key)
    {
        return Pack(string.Create(CultureInfo.InvariantCulture, $"{DistancePrefix}:{key.SquaredMetres:R}:{key.Id}"));
    }

    public static bool TryDecode(string? cursor, out EventPageKey? key)
    {
        key = null;

        if (string.IsNullOrEmpty(cursor))
            return true;

        if (!TryUnpack(cursor, out var parts)
            || parts.Length != 2
            || !long.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var ticks)
            || !int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var id)
            || ticks > DateTime.MaxValue.Ticks)
            return false;

        key = new EventPageKey(new DateTime(ticks, DateTimeKind.Utc), id);
        return true;
    }

    public static bool TryDecodeDistance(string? cursor, out EventDistanceKey? key)
    {
        key = null;

        if (string.IsNullOrEmpty(cursor))
            return true;

        if (!TryUnpack(cursor, out var parts)
            || parts.Length != 3
            || parts[0] != DistancePrefix
            || !double.TryParse(parts[1], NumberStyles.Float, CultureInfo.InvariantCulture, out var squaredMetres)
            || !double.IsFinite(squaredMetres)
            || squaredMetres < 0
            || !int.TryParse(parts[2], NumberStyles.None, CultureInfo.InvariantCulture, out var id))
            return false;

        key = new EventDistanceKey(squaredMetres, id);
        return true;
    }

    private static string Pack(string raw)
    {
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(raw));
    }

    private static bool TryUnpack(string cursor, out string[] parts)
    {
        try
        {
            parts = Encoding.UTF8.GetString(Convert.FromBase64String(cursor)).Split(':');
            return true;
        }
        catch (FormatException)
        {
            parts = [];
            return false;
        }
    }
}
