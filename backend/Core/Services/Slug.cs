// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Globalization;
using System.Text;

namespace Core.Services;

// keep-comment: the URL-safe name of a municipality or a data source; cross-cutting, so validators use it too
public static class Slug
{
    // keep-comment: a data source key is two slugs and a colon, which Facility.SourceId has room for
    public const int MaxLength = 50;

    public static readonly string FitsMessage = $"The name needs letters or digits, and at most {MaxLength} of them.";

    // keep-comment: "Upplands Väsby" -> "upplands-vasby"; diacritics dropped, everything else not a letter or digit becomes one dash
    public static string From(string name)
    {
        var builder = new StringBuilder();
        var pendingDash = false;

        foreach (var c in name.Trim().Normalize(NormalizationForm.FormD).ToLowerInvariant())
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark)
                continue;

            if (c is >= 'a' and <= 'z' or >= '0' and <= '9')
            {
                if (pendingDash && builder.Length > 0)
                    builder.Append('-');

                builder.Append(c);
                pendingDash = false;
            }
            else
            {
                pendingDash = true;
            }
        }

        return builder.ToString();
    }

    public static bool Fits(string name)
    {
        return From(name).Length is > 0 and <= MaxLength;
    }
}
