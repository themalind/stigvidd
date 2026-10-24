// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace StigviddLinks;

public static class WellKnown
{
    public const string TrailPathPattern = "/trail/*";

    public static object? AppleAppSiteAssociation(AppLinksOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.AppleTeamId) || string.IsNullOrWhiteSpace(options.IosBundleId))
            return null;

        return new
        {
            applinks = new
            {
                details = new[]
                {
                    new
                    {
                        appIDs = new[] { $"{options.AppleTeamId}.{options.IosBundleId}" },
                        components = new[] { new Dictionary<string, string> { ["/"] = TrailPathPattern } },
                    },
                },
            },
        };
    }

    public static object? AssetLinks(AppLinksOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.AndroidPackage) || options.AndroidSha256Fingerprints.Length == 0)
            return null;

        return new[]
        {
            new
            {
                relation = new[] { "delegate_permission/common.handle_all_urls" },
                target = new
                {
                    @namespace = "android_app",
                    package_name = options.AndroidPackage,
                    sha256_cert_fingerprints = options.AndroidSha256Fingerprints,
                },
            },
        };
    }
}
