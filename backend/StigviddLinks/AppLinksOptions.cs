// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace StigviddLinks;

// Everything here is published in a page or a .well-known file, so none of it is a secret. keep-comment: tells a reader it may live in appsettings.json
public class AppLinksOptions
{
    public const string SectionName = "AppLinks";

    public string PublicBaseUrl { get; set; } = string.Empty;
    public string SiteUrl { get; set; } = string.Empty;
    public string AppScheme { get; set; } = "stigvidd";

    // Empty values switch off the matching .well-known file or store button. keep-comment: absence is a feature switch, not an error
    public string AppleTeamId { get; set; } = string.Empty;
    public string IosBundleId { get; set; } = string.Empty;
    public string AndroidPackage { get; set; } = string.Empty;
    public string[] AndroidSha256Fingerprints { get; set; } = [];
    public string AppStoreUrl { get; set; } = string.Empty;
    public string PlayStoreUrl { get; set; } = string.Empty;

    // Shown to Android visitors while PlayStoreUrl is empty. keep-comment: the Play test is closed, so testers are recruited here
    public string AndroidTestUrl { get; set; } = string.Empty;
}
