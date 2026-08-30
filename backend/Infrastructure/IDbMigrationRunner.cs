// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure;

public interface IDbMigrationRunner
{
    Task RunMigrationsAsync(CancellationToken cancellationToken);
}
