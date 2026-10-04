// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Diagnostics;
using System.IO.Compression;
using Core.Interfaces.Services;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;
using WebDataContracts.ResponseModels.DataTransfer;

namespace Core.Services;

public class DataTransferService : IDataTransferService
{
    private const string AppDumpEntry = "database.dump";
    private const string KeycloakDumpEntry = "keycloak.dump";
    private const string ManifestEntry = "manifest.json";
    private const string MediaPrefix = "media/";
    private const string TrailImportPrefix = "trail-imports/";

    private readonly IDbContextFactory<StigViddDbContext> _dbContextFactory;
    private readonly IWebDavService _webDav;
    private readonly ITrailImportFileStore _trailImportFiles;
    private readonly IMaintenanceGate _maintenance;
    private readonly ILogger<DataTransferService> _logger;
    private readonly string _appConnectionString;
    private readonly string _keycloakDbName;
    private readonly bool _sharedServices;

    public DataTransferService(
        IDbContextFactory<StigViddDbContext> dbContextFactory,
        IWebDavService webDav,
        ITrailImportFileStore trailImportFiles,
        IMaintenanceGate maintenance,
        IConfiguration configuration,
        ILogger<DataTransferService> logger)
    {
        _dbContextFactory = dbContextFactory;
        _webDav = webDav;
        _trailImportFiles = trailImportFiles;
        _maintenance = maintenance;
        _logger = logger;
        _appConnectionString = configuration.GetConnectionString("StigVidd")
            ?? throw new InvalidOperationException("Connection string 'StigVidd' not found.");
        _keycloakDbName = configuration["KEYCLOAK_DB"] ?? "keycloak";
        _sharedServices = configuration.GetValue<bool>("DataTransfer:SharedServices");
    }

    public DataTransferInfoResponse GetInfo() => new()
    {
        SharedServices = _sharedServices,
        ExportIncludesKeycloak = !_sharedServices,
        ImportRestoresKeycloak = !_sharedServices,
        ImportClearsOutbound = _sharedServices,
    };

    public async Task<Stream> CreateExportAsync(bool anonymize, CancellationToken ctoken)
    {
        var tempDir = CreateTempDir();
        var zipPath = Path.Combine(Path.GetTempPath(), $"stigvidd-export-{Guid.NewGuid():N}.zip");
        try
        {
            var appConn = new NpgsqlConnectionStringBuilder(_appConnectionString);

            var appDump = Path.Combine(tempDir, "app.dump");
            await PgDumpAsync(appConn, Database(appConn), appDump, ctoken);

            if (anonymize)
                await AnonymizeDumpAsync(appConn, appDump, tempDir, ctoken);

            // Keycloak's users are personal data, and on a shared-services host its database is an unused empty one. keep-comment: both reasons it is left out
            var keycloakDump = Path.Combine(tempDir, "keycloak.dump");
            var hasKeycloak = !anonymize && !_sharedServices
                && await TryPgDumpAsync(appConn, _keycloakDbName, keycloakDump, ctoken);

            string? latestMigration;
            IReadOnlyCollection<string> mediaPaths;
            List<string> trailImportPaths;
            await using (var db = await _dbContextFactory.CreateDbContextAsync(ctoken))
            {
                latestMigration = (await db.Database.GetAppliedMigrationsAsync(ctoken)).LastOrDefault();
                mediaPaths = await GetReferencedMediaPathsAsync(db, ctoken);
                trailImportPaths = await db.TrailImportSessions.Select(s => s.StoredPath).ToListAsync(ctoken);
            }

            var mediaExported = 0;
            var mediaMissing = 0;
            var trailImportFiles = 0;

            await using (var zipFile = File.Create(zipPath))
            {
                using var zip = new ZipArchive(zipFile, ZipArchiveMode.Create);

                await AddFileEntryAsync(zip, AppDumpEntry, appDump, ctoken);
                if (hasKeycloak)
                    await AddFileEntryAsync(zip, KeycloakDumpEntry, keycloakDump, ctoken);

                foreach (var path in mediaPaths)
                {
                    ctoken.ThrowIfCancellationRequested();
                    await using var fileStream = await _webDav.DownloadFileAsync(path);
                    if (fileStream is null)
                    {
                        mediaMissing++;
                        continue;
                    }

                    var entry = zip.CreateEntry(MediaPrefix + path.TrimStart('/'), CompressionLevel.NoCompression);
                    await using var entryStream = entry.Open();
                    await fileStream.CopyToAsync(entryStream, ctoken);
                    mediaExported++;
                }

                foreach (var storedPath in trailImportPaths.Distinct())
                {
                    if (!File.Exists(storedPath))
                        continue;

                    await AddFileEntryAsync(zip, TrailImportPrefix + Path.GetFileName(storedPath), storedPath, ctoken);
                    trailImportFiles++;
                }

                var manifest = new DataTransferManifest
                {
                    FormatVersion = DataTransferManifest.CurrentFormatVersion,
                    ExportedAtUtc = DateTimeOffset.UtcNow,
                    IncludesKeycloak = hasKeycloak,
                    Anonymized = anonymize,
                    LatestMigration = latestMigration,
                    MediaExported = mediaExported,
                    MediaMissing = mediaMissing,
                    TrailImportFiles = trailImportFiles,
                };
                var manifestEntry = zip.CreateEntry(ManifestEntry, CompressionLevel.Optimal);
                await using var manifestStream = manifestEntry.Open();
                await manifestStream.WriteAsync(manifest.ToJson(), ctoken);
            }

            _logger.LogInformation(
                "Export complete: anonymized={Anonymized}, keycloak={HasKeycloak}, media exported={Exported}, missing={Missing}, trail import files={TrailImportFiles}",
                anonymize, hasKeycloak, mediaExported, mediaMissing, trailImportFiles);

            return new FileStream(zipPath, FileMode.Open, FileAccess.Read, FileShare.None, 81920,
                FileOptions.Asynchronous | FileOptions.DeleteOnClose);
        }
        catch
        {
            TryDeleteFile(zipPath);
            throw;
        }
        finally
        {
            TryDeleteDir(tempDir);
        }
    }

    // The personal data is replaced in a scratch database on this server, so it never leaves the host. keep-comment: the GDPR reason for the detour
    private async Task AnonymizeDumpAsync(NpgsqlConnectionStringBuilder appConn, string appDump, string tempDir, CancellationToken ctoken)
    {
        var scratchName = $"stigvidd_anon_{Guid.NewGuid():N}";
        var scratchConn = new NpgsqlConnectionStringBuilder(appConn.ConnectionString) { Database = scratchName, Pooling = false };

        await ExecuteAdminSqlAsync(appConn, $"CREATE DATABASE \"{scratchName}\"", ctoken);
        try
        {
            await RunPgToolAsync("pg_restore",
                [
                    .. ConnectionArgs(appConn), "-d", scratchName,
                    "--no-owner", "--no-privileges", "--exit-on-error", "--single-transaction",
                    appDump,
                ],
                appConn.Password, ctoken);

            var options = new DbContextOptionsBuilder<StigViddDbContext>()
                .UseNpgsql(scratchConn.ConnectionString, o => o.UseNetTopologySuite())
                .Options;
            await using (var scratch = new StigViddDbContext(options))
                await DataAnonymizer.AnonymizeAsync(scratch, ctoken);

            var anonymizedDump = Path.Combine(tempDir, "anonymized.dump");
            await PgDumpAsync(appConn, scratchName, anonymizedDump, ctoken);
            File.Move(anonymizedDump, appDump, overwrite: true);
        }
        finally
        {
            try
            {
                await ExecuteAdminSqlAsync(appConn, $"DROP DATABASE IF EXISTS \"{scratchName}\" WITH (FORCE)", CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Export: scratch database {Database} could not be dropped; drop it by hand.", scratchName);
            }
        }
    }

    public async Task<DataTransferImportResponse> ImportAsync(Stream input, CancellationToken ctoken)
    {
        using var paused = _maintenance.Pause();

        var tempDir = CreateTempDir();
        var zipPath = Path.Combine(tempDir, "import.zip");
        try
        {
            // Buffered to a seekable file so ZipArchive can read the central directory. keep-comment: why the upload is copied first
            await using (var fs = File.Create(zipPath))
                await input.CopyToAsync(fs, ctoken);

            using var zip = ZipFile.OpenRead(zipPath);

            var manifestEntry = zip.GetEntry(ManifestEntry)
                ?? throw new InvalidOperationException("Not a valid export archive (missing manifest.json).");
            DataTransferManifest manifest;
            await using (var manifestStream = manifestEntry.Open())
                manifest = DataTransferManifest.Parse(manifestStream);

            var appConn = new NpgsqlConnectionStringBuilder(_appConnectionString);
            var hasKeycloakDump = zip.GetEntry(KeycloakDumpEntry) is not null;

            IReadOnlyCollection<string> knownMigrations;
            await using (var db = await _dbContextFactory.CreateDbContextAsync(ctoken))
                knownMigrations = db.Database.GetMigrations().ToList();

            var keycloakDbExists = hasKeycloakDump && !_sharedServices && await DatabaseExistsAsync(appConn, _keycloakDbName, ctoken);

            var plan = DataTransferPreflight.Plan(manifest, hasKeycloakDump, knownMigrations, _sharedServices, keycloakDbExists);

            var appDump = ExtractEntry(zip, AppDumpEntry, tempDir)
                ?? throw new InvalidOperationException($"Archive is missing '{AppDumpEntry}'.");

            await RestoreAppDatabaseAsync(appConn, appDump, tempDir, ctoken);
            NpgsqlConnection.ClearAllPools();

            if (plan.NeutralizeOutbound)
            {
                await using var db = await _dbContextFactory.CreateDbContextAsync(ctoken);
                await DataAnonymizer.NeutralizeOutboundAsync(db, ctoken);
            }

            if (plan.RestoreKeycloak && ExtractEntry(zip, KeycloakDumpEntry, tempDir) is { } keycloakDump)
            {
                await RunPgToolAsync("pg_restore",
                    [
                        .. ConnectionArgs(appConn), "-d", _keycloakDbName,
                        "--clean", "--if-exists", "--no-owner", "--no-privileges",
                        "--exit-on-error", "--single-transaction",
                        keycloakDump,
                    ],
                    appConn.Password, ctoken);
            }

            var (mediaRestored, mediaFailed) = await RestoreMediaAsync(zip, ctoken);
            var trailImportFiles = await RestoreTrailImportFilesAsync(zip, ctoken);

            var notes = plan.Notes.ToList();
            if (mediaFailed > 0)
                notes.Add($"{mediaFailed} media file(s) could not be uploaded; see the API log.");
            if (manifest.MediaMissing > 0)
                notes.Add($"{manifest.MediaMissing} media file(s) were already missing on the exporting host.");

            string[] restart = plan.RestoreKeycloak ? ["api", "keycloak"] : ["api"];

            _logger.LogInformation(
                "Import complete: anonymized={Anonymized}, keycloak restored={Keycloak}, outbound cleared={Outbound}, media restored={Restored}, failed={Failed}, trail import files={TrailImportFiles}",
                manifest.Anonymized, plan.RestoreKeycloak, plan.NeutralizeOutbound, mediaRestored, mediaFailed, trailImportFiles);

            return new DataTransferImportResponse
            {
                Message = $"Import complete. Restart to apply: docker compose restart {string.Join(' ', restart)}",
                Anonymized = manifest.Anonymized,
                KeycloakRestored = plan.RestoreKeycloak,
                OutboundCleared = plan.NeutralizeOutbound,
                MediaRestored = mediaRestored,
                MediaFailed = mediaFailed,
                TrailImportFilesRestored = trailImportFiles,
                Notes = notes,
                RestartServices = restart,
            };
        }
        finally
        {
            TryDeleteDir(tempDir);
        }
    }

    // One psql transaction: dropping the schema first removes tables from migrations newer than the archive, which a plain --clean leaves behind with no history row. keep-comment: why not pg_restore --clean
    private async Task RestoreAppDatabaseAsync(NpgsqlConnectionStringBuilder appConn, string appDump, string tempDir, CancellationToken ctoken)
    {
        var sql = Path.Combine(tempDir, "restore.sql");
        await RunPgToolAsync("pg_restore", ["--no-owner", "--no-privileges", "-f", sql, appDump], appConn.Password, ctoken);

        // The postgis image creates tiger, tiger_data and topology in POSTGRES_DB, and the dump creates them again; see docs/notes/postgis-image-schemas-break-a-dump-restore.md. keep-comment: why every dumped schema is dropped, not only dbo
        var schemas = new List<string>();
        foreach (var line in File.ReadLines(sql))
        {
            if (line.StartsWith("CREATE SCHEMA ", StringComparison.Ordinal) && line.EndsWith(';'))
                schemas.Add(line["CREATE SCHEMA ".Length..^1]);
        }

        var prelude = Path.Combine(tempDir, "prelude.sql");
        await File.WriteAllTextAsync(prelude,
            string.Concat(schemas.Select(schema => $"DROP SCHEMA IF EXISTS {schema} CASCADE;\n"))
            + "DROP SCHEMA IF EXISTS dbo CASCADE;\nDROP TABLE IF EXISTS public.\"__EFMigrationsHistory\";\n", ctoken);

        await RunPgToolAsync("psql",
            [
                .. ConnectionArgs(appConn), "-d", Database(appConn),
                "-X", "-q", "-v", "ON_ERROR_STOP=1", "--single-transaction",
                "-f", prelude, "-f", sql,
            ],
            appConn.Password, ctoken);
    }

    private async Task<(int Restored, int Failed)> RestoreMediaAsync(ZipArchive zip, CancellationToken ctoken)
    {
        var restored = 0;
        var failed = 0;
        foreach (var entry in zip.Entries)
        {
            if (!entry.FullName.StartsWith(MediaPrefix, StringComparison.Ordinal) || entry.Length == 0)
                continue;

            ctoken.ThrowIfCancellationRequested();
            var targetPath = entry.FullName[MediaPrefix.Length..];
            await using var entryStream = entry.Open();
            var result = await _webDav.UploadToPathAsync(entryStream, targetPath);
            if (result.Success)
            {
                restored++;
            }
            else
            {
                failed++;
                _logger.LogWarning("Import: media upload failed for {Path}", targetPath);
            }
        }

        return (restored, failed);
    }

    private async Task<int> RestoreTrailImportFilesAsync(ZipArchive zip, CancellationToken ctoken)
    {
        var root = _trailImportFiles.RootDirectory;
        var restored = 0;

        foreach (var entry in zip.Entries)
        {
            if (!entry.FullName.StartsWith(TrailImportPrefix, StringComparison.Ordinal))
                continue;

            var name = Path.GetFileName(entry.FullName);
            if (name.Length == 0)
                continue;

            Directory.CreateDirectory(root);
            await using var entryStream = entry.Open();
            await using var file = File.Create(Path.Combine(root, name));
            await entryStream.CopyToAsync(file, ctoken);
            restored++;
        }

        // The exporting host may keep these files under another directory. keep-comment: why StoredPath is rewritten
        await using var db = await _dbContextFactory.CreateDbContextAsync(ctoken);
        var sessions = await db.TrailImportSessions.ToListAsync(ctoken);
        foreach (var session in sessions)
            session.StoredPath = Path.Combine(root, Path.GetFileName(session.StoredPath));
        await db.SaveChangesAsync(ctoken);

        return restored;
    }

    private static async Task<IReadOnlyCollection<string>> GetReferencedMediaPathsAsync(StigViddDbContext db, CancellationToken ctoken)
    {
        var paths = new HashSet<string>(StringComparer.Ordinal);
        paths.UnionWith(await db.TrailImages.Select(x => x.ImageUrl).ToListAsync(ctoken));
        paths.UnionWith(await db.FacilityImages.Select(x => x.ImageUrl).ToListAsync(ctoken));
        paths.UnionWith(await db.HikeImages.Select(x => x.ImageUrl).ToListAsync(ctoken));
        paths.UnionWith(await db.ReviewImages.Select(x => x.ImageUrl).ToListAsync(ctoken));
        paths.UnionWith((await db.Trails.Select(x => x.TrailSymbolImage).ToListAsync(ctoken)).OfType<string>());
        paths.UnionWith((await db.CityAreas.Select(x => x.ImageUrl).ToListAsync(ctoken)).OfType<string>());

        // An absolute URL points at media hosted elsewhere, which is not this host's to copy. keep-comment: why http values are skipped
        paths.RemoveWhere(p => string.IsNullOrWhiteSpace(p) || p.StartsWith("http", StringComparison.OrdinalIgnoreCase));
        return paths;
    }

    private Task PgDumpAsync(NpgsqlConnectionStringBuilder conn, string database, string outFile, CancellationToken ctoken)
        => RunPgToolAsync("pg_dump",
            [
                .. ConnectionArgs(conn),
                "--format=custom", "--no-owner", "--no-privileges",
                // spatial_ref_sys is repopulated by CREATE EXTENSION postgis on restore; dumping its data would collide with those rows. keep-comment: restore collision
                "--exclude-table-data=public.spatial_ref_sys",
                "--file", outFile, database,
            ],
            conn.Password, ctoken);

    private async Task<bool> TryPgDumpAsync(NpgsqlConnectionStringBuilder conn, string database, string outFile, CancellationToken ctoken)
    {
        try
        {
            await PgDumpAsync(conn, database, outFile, ctoken);
            return true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Skipping database '{Database}' (not dumpable)", database);
            return false;
        }
    }

    private static async Task<bool> DatabaseExistsAsync(NpgsqlConnectionStringBuilder conn, string database, CancellationToken ctoken)
    {
        await using var connection = new NpgsqlConnection(conn.ConnectionString);
        await connection.OpenAsync(ctoken);
        await using var command = new NpgsqlCommand("SELECT 1 FROM pg_database WHERE datname = @name", connection);
        command.Parameters.AddWithValue("name", database);
        return await command.ExecuteScalarAsync(ctoken) is not null;
    }

    private static async Task ExecuteAdminSqlAsync(NpgsqlConnectionStringBuilder conn, string sql, CancellationToken ctoken)
    {
        await using var connection = new NpgsqlConnection(conn.ConnectionString);
        await connection.OpenAsync(ctoken);
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync(ctoken);
    }

    private static string Database(NpgsqlConnectionStringBuilder conn) =>
        conn.Database ?? throw new InvalidOperationException("Connection string 'StigVidd' names no database.");

    private static string[] ConnectionArgs(NpgsqlConnectionStringBuilder conn) =>
    [
        "-h", conn.Host ?? throw new InvalidOperationException("Connection string 'StigVidd' names no host."),
        "-p", conn.Port.ToString(),
        "-U", conn.Username ?? throw new InvalidOperationException("Connection string 'StigVidd' names no user."),
    ];

    private static async Task RunPgToolAsync(string tool, string[] args, string? password, CancellationToken ctoken)
    {
        var psi = new ProcessStartInfo(tool)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        foreach (var a in args) psi.ArgumentList.Add(a);
        if (password is not null)
            psi.Environment["PGPASSWORD"] = password;
        // Without this a failure's message is buried under "drop cascades to ..." notices. keep-comment: keeps the real error first in stderr
        psi.Environment["PGOPTIONS"] = "-c client_min_messages=warning";

        using var process = Process.Start(psi)
            ?? throw new InvalidOperationException($"Failed to start {tool}.");

        var stdout = process.StandardOutput.ReadToEndAsync(ctoken);
        var stderr = await process.StandardError.ReadToEndAsync(ctoken);
        await stdout;
        await process.WaitForExitAsync(ctoken);

        if (process.ExitCode != 0)
            throw new InvalidOperationException($"{tool} failed (exit {process.ExitCode}): {stderr}");
    }

    private static async Task AddFileEntryAsync(ZipArchive zip, string entryName, string filePath, CancellationToken ctoken)
    {
        var entry = zip.CreateEntry(entryName, CompressionLevel.NoCompression);
        await using var entryStream = entry.Open();
        await using var fileStream = File.OpenRead(filePath);
        await fileStream.CopyToAsync(entryStream, ctoken);
    }

    private static string? ExtractEntry(ZipArchive zip, string entryName, string tempDir)
    {
        var entry = zip.GetEntry(entryName);
        if (entry is null) return null;

        var outPath = Path.Combine(tempDir, entryName);
        using var entryStream = entry.Open();
        using var fileStream = File.Create(outPath);
        entryStream.CopyTo(fileStream);
        return outPath;
    }

    private static string CreateTempDir()
    {
        var dir = Path.Combine(Path.GetTempPath(), "stigvidd-transfer-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        return dir;
    }

    private void TryDeleteFile(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); }
        catch (Exception ex) { _logger.LogWarning(ex, "Failed to clean up temp file {Path}", path); }
    }

    private void TryDeleteDir(string dir)
    {
        try { if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true); }
        catch (Exception ex) { _logger.LogWarning(ex, "Failed to clean up temp dir {Dir}", dir); }
    }
}
