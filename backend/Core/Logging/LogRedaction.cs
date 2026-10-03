// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Text.RegularExpressions;

namespace Core.Logging;

public static partial class LogRedaction
{
    public static string ScrubEmails(string? text) =>
        string.IsNullOrEmpty(text) ? "" : EmailPattern().Replace(text, "***@$1");

    public static string MaskEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return "***";

        var at = email.LastIndexOf('@');
        var domain = at < 0 ? "" : email[(at + 1)..].Trim();

        return domain.Length == 0 ? "***" : $"***@{domain}";
    }

    [GeneratedRegex(@"[^\s<>""'(),;:\[\]@]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})")]
    private static partial Regex EmailPattern();
}
