// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Microsoft.Data.Sqlite;

namespace IntegrationTests;

// keep-comment: mod_spatialite frees libxml2's global state on every close, so parallel opens/closes abort the process - docs/notes/mod-spatialite-close-frees-libxml2.md
internal sealed class SerializedSqliteConnection(string connectionString)
    : SqliteConnection(connectionString)
{
    private static readonly Lock NativeLock = new();

    public override void Open()
    {
        lock (NativeLock)
            base.Open();
    }

    public override void Close()
    {
        lock (NativeLock)
            base.Close();
    }
}
