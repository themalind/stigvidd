// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Data.Common;
using Microsoft.EntityFrameworkCore;

namespace Core.Repositories;

// keep-comment: 23505 is PostgreSQL's unique_violation; SQLite (the tests) sets no SqlState, so there it reads as a plain error
internal static class UniqueViolation
{
    private const string PostgresUniqueViolation = "23505";

    public static bool Is(DbUpdateException exception)
    {
        return exception.InnerException is DbException { SqlState: PostgresUniqueViolation };
    }
}
