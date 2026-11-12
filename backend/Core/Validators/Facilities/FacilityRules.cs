// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Validators.Facilities;

// keep-comment: the limits a saved facility keeps; the admin validator and the file import both hold to them
public static class FacilityRules
{
    public const int NameMaxLength = 100;
    public const int LocationMaxLength = 200;
    public const int DescriptionMaxLength = 2000;
    public const int UrlMaxLength = 500;

    public static bool IsEmptyOrAbsoluteHttpUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return true;
        }

        return Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
    }
}
