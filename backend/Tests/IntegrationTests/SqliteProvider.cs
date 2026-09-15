// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

#if !WINDOWS
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace IntegrationTests;

internal static class SqliteProvider
{
    // Binds SQLite to the system libsqlite3 that mod_spatialite is linked against.
    // Runs before any test so no SqliteConnection can pick a provider first.
    [ModuleInitializer]
    internal static void Init()
    {
        SQLitePCL.raw.SetProvider(new SQLitePCL.SQLite3Provider_sqlite3());

        // Holds a reference to mod_spatialite for the life of the process, so a connection
        // closing in one test class never unloads it while another is loading it.
        // See docs/notes/mod-spatialite-unload-race.md.
        NativeLibrary.TryLoad("mod_spatialite.so", out _);
    }
}
#endif
