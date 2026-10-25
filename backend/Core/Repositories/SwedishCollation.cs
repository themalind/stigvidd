// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data;

namespace Core.Repositories;

// en_US.UTF-8 puts Ä and Å among the A's; SQLite (the tests) has no Swedish collation. keep-comment: why the provider switch exists
internal static class SwedishCollation
{
    private const string SwedishIcuCollation = "sv-SE-x-icu";
    private const string NpgsqlProvider = "Npgsql.EntityFrameworkCore.PostgreSQL";

    public static string? For(StigViddDbContext context)
    {
        return context.Database.ProviderName == NpgsqlProvider ? SwedishIcuCollation : null;
    }
}
