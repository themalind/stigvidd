#if !WINDOWS
using System.Runtime.CompilerServices;

namespace IntegrationTests;

internal static class SqliteProvider
{
    // Binds SQLite to the system libsqlite3 that mod_spatialite is linked against.
    // Runs before any test so no SqliteConnection can pick a provider first.
    [ModuleInitializer]
    internal static void Init() =>
        SQLitePCL.raw.SetProvider(new SQLitePCL.SQLite3Provider_sqlite3());
}
#endif
