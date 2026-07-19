namespace Core.Interfaces.Services;

/// <summary>
/// Whole-environment export/import for host migration: the application
/// database, the referenced media files, and the Keycloak database (realms,
/// users, credentials) — bundled into a single archive.
/// </summary>
public interface IDataTransferService
{
    /// <summary>Writes a migration archive (zip) to <paramref name="output"/>.</summary>
    Task ExportAsync(Stream output, CancellationToken ctoken);

    /// <summary>
    /// Restores a migration archive read from <paramref name="input"/>.
    /// DESTRUCTIVE: replaces the target's data. Intended for a freshly deployed
    /// target host; api and keycloak should be restarted afterwards.
    /// </summary>
    Task ImportAsync(Stream input, CancellationToken ctoken);
}
