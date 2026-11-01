// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Microsoft.Extensions.Configuration;

namespace Core.Events;

internal static class DomainEventConfig
{
    // A zero or negative value would mean "never wait" or "delete everything"; fall back to the default instead. keep-comment: misconfiguration must not empty the table
    public static int ReadPositive(IConfiguration configuration, string key, int fallback) =>
        int.TryParse(configuration[key], out var configured) && configured > 0 ? configured : fallback;
}
