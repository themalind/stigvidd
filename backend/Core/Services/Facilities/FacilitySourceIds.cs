// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Services.Facilities;

// keep-comment: a SourceId is "<source key>:<the source's id>"; the key is "<municipality slug>:<source slug>" and slugs have no colon
public static class FacilitySourceIds
{
    // keep-comment: a slug has no colon, so two municipalities' keys can never coincide
    public static string KeyFor(string municipalitySlug, string sourceSlug)
    {
        return $"{municipalitySlug}:{sourceSlug}";
    }

    public static string Of(string sourceKey, string id)
    {
        return PrefixOf(sourceKey) + id;
    }

    public static string PrefixOf(string sourceKey)
    {
        return sourceKey + ":";
    }

    // keep-comment: the source's own id may hold colons, so the key is the first two parts; a one-part key predates municipalities
    public static string? KeyOf(string? sourceId)
    {
        if (string.IsNullOrEmpty(sourceId))
            return null;

        var parts = sourceId.Split(':');

        return parts.Length > 2 ? $"{parts[0]}:{parts[1]}" : parts[0];
    }
}
