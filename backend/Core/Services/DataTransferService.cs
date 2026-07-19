using System.Diagnostics;
using System.IO.Compression;
using System.Text.Json;
using Core.Interfaces.Services;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Core.Services;

public class DataTransferService : IDataTransferService
{
    // Bump when the archive layout changes in an incompatible way.
    private const int FormatVersion = 1;

    private const string AppDumpEntry = "database.dump";
    private const string KeycloakDumpEntry = "keycloak.dump";
    private const string ManifestEntry = "manifest.json";
    private const string MediaPrefix = "media/";

    private readonly IDbContextFactory<StigViddDbContext> _dbContextFactory;
    private readonly IWebDavService _webDav;
    private readonly ILogger<DataTransferService> _logger;
    private readonly string _appConnectionString;
    private readonly string _keycloakDbName;

    public DataTransferService(
        IDbContextFactory<StigViddDbContext> dbContextFactory,
        IWebDavService webDav,
        IConfiguration configuration,
        ILogger<DataTransferService> logger)
    {
        _dbContextFactory = dbContextFactory;
        _webDav = webDav;
        _logger = logger;
        _appConnectionString = configuration.GetConnectionString("StigVidd")
            ?? throw new InvalidOperationException("Connection string 'StigVidd' not found.");
        // Keycloak shares the Postgres instance; its database name is configurable.
        _keycloakDbName = configuration["KEYCLOAK_DB"] ?? "keycloak";
    }

    public async Task ExportAsync(Stream output, CancellationToken ctoken)
    {
        var tempDir = CreateTempDir();
        try
        {
            var appConn = new NpgsqlConnectionStringBuilder(_appConnectionString);

            // 1) Application database (custom format, already compressed).
            var appDump = Path.Combine(tempDir, "app.dump");
            await PgDumpAsync(appConn, appConn.Database!, appDump, ctoken);

            // 2) Keycloak database (same server, different db) — realms, users,
            //    credentials. Best-effort: skip if it isn't present.
            var keycloakDump = Path.Combine(tempDir, "keycloak.dump");
            var hasKeycloak = await TryPgDumpAsync(appConn, _keycloakDbName, keycloakDump, ctoken);

            // 3) Media paths referenced by the database.
            var mediaPaths = await GetReferencedMediaPathsAsync(ctoken);

            using var zip = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true);

            await AddFileEntryAsync(zip, AppDumpEntry, appDump, ctoken);
            if (hasKeycloak)
                await AddFileEntryAsync(zip, KeycloakDumpEntry, keycloakDump, ctoken);

            var mediaExported = 0;
            var mediaMissing = 0;
            foreach (var path in mediaPaths)
            {
                ctoken.ThrowIfCancellationRequested();
                await using var fileStream = await _webDav.DownloadFileAsync(path);
                if (fileStream is null) { mediaMissing++; continue; }

                var entry = zip.CreateEntry(MediaPrefix + path.TrimStart('/'), CompressionLevel.NoCompression);
                await using var entryStream = entry.Open();
                await fileStream.CopyToAsync(entryStream, ctoken);
                mediaExported++;
            }

            var manifest = new
            {
                formatVersion = FormatVersion,
                exportedAtUtc = DateTimeOffset.UtcNow,
                includesKeycloak = hasKeycloak,
                mediaExported,
                mediaMissing,
            };
            var manifestEntry = zip.CreateEntry(ManifestEntry, CompressionLevel.Optimal);
            await using (var ms = manifestEntry.Open())
                await JsonSerializer.SerializeAsync(ms, manifest, cancellationToken: ctoken);

            _logger.LogInformation(
                "Export complete: keycloak={HasKeycloak}, media exported={Exported}, missing={Missing}",
                hasKeycloak, mediaExported, mediaMissing);
        }
        finally
        {
            TryDeleteDir(tempDir);
        }
    }

    public async Task ImportAsync(Stream input, CancellationToken ctoken)
    {
        var tempDir = CreateTempDir();
        var zipPath = Path.Combine(tempDir, "import.zip");
        try
        {
            // Buffer to a seekable file so ZipArchive can read the central directory.
            await using (var fs = File.Create(zipPath))
                await input.CopyToAsync(fs, ctoken);

            using var zip = ZipFile.OpenRead(zipPath);

            ValidateManifest(zip);

            var appConn = new NpgsqlConnectionStringBuilder(_appConnectionString);

            // 1) Restore application database (destructive).
            var appDump = ExtractEntry(zip, AppDumpEntry, tempDir)
                ?? throw new InvalidOperationException($"Archive is missing '{AppDumpEntry}'.");
            await PgRestoreAsync(appConn, appConn.Database!, appDump, ctoken);

            // 2) Restore Keycloak database if included.
            var keycloakDump = ExtractEntry(zip, KeycloakDumpEntry, tempDir);
            if (keycloakDump is not null)
                await PgRestoreAsync(appConn, _keycloakDbName, keycloakDump, ctoken);

            // 3) Restore media to their exact paths (nginx recreates dirs).
            var mediaRestored = 0;
            foreach (var entry in zip.Entries)
            {
                if (!entry.FullName.StartsWith(MediaPrefix, StringComparison.Ordinal) || entry.Length == 0)
                    continue;

                ctoken.ThrowIfCancellationRequested();
                var targetPath = entry.FullName[MediaPrefix.Length..];
                await using var entryStream = entry.Open();
                var result = await _webDav.UploadToPathAsync(entryStream, targetPath);
                if (result.Success) mediaRestored++;
                else _logger.LogWarning("Import: media upload failed for {Path}", targetPath);
            }

            _logger.LogInformation("Import complete: media restored={Restored}", mediaRestored);
        }
        finally
        {
            TryDeleteDir(tempDir);
        }
    }

    private async Task<IReadOnlyCollection<string>> GetReferencedMediaPathsAsync(CancellationToken ctoken)
    {
        await using var db = await _dbContextFactory.CreateDbContextAsync(ctoken);

        var paths = new HashSet<string>(StringComparer.Ordinal);
        paths.UnionWith(await db.TrailImages.Select(x => x.ImageUrl).ToListAsync(ctoken));
        paths.UnionWith(await db.FacilityImages.Select(x => x.ImageUrl).ToListAsync(ctoken));
        paths.UnionWith(await db.HikeImages.Select(x => x.ImageUrl).ToListAsync(ctoken));
        paths.UnionWith(await db.ReviewImages.Select(x => x.ImageUrl).ToListAsync(ctoken));
        paths.UnionWith(await db.Trails.Select(x => x.TrailSymbolImage).ToListAsync(ctoken));

        paths.RemoveWhere(string.IsNullOrWhiteSpace);
        return paths;
    }

    private static void ValidateManifest(ZipArchive zip)
    {
        var manifestEntry = zip.GetEntry(ManifestEntry)
            ?? throw new InvalidOperationException("Not a valid export archive (missing manifest.json).");

        using var stream = manifestEntry.Open();
        using var doc = JsonDocument.Parse(ReadAllBytes(stream));
        var version = doc.RootElement.TryGetProperty("formatVersion", out var v) ? v.GetInt32() : -1;
        if (version != FormatVersion)
            throw new InvalidOperationException(
                $"Unsupported export format version {version}; this server expects {FormatVersion}.");
    }

    // ---- Postgres process helpers -------------------------------------------

    private Task PgDumpAsync(NpgsqlConnectionStringBuilder conn, string database, string outFile, CancellationToken ctoken)
        => RunPgToolAsync("pg_dump", conn,
            [
                "-h", conn.Host!, "-p", conn.Port.ToString(), "-U", conn.Username!,
                "--format=custom", "--no-owner", "--no-privileges",
                // spatial_ref_sys is repopulated by CREATE EXTENSION postgis on
                // restore; dumping its data would collide with those rows.
                "--exclude-table-data=public.spatial_ref_sys",
                "--file", outFile, database,
            ],
            conn.Password!, ctoken);

    private async Task<bool> TryPgDumpAsync(NpgsqlConnectionStringBuilder conn, string database, string outFile, CancellationToken ctoken)
    {
        try
        {
            await PgDumpAsync(conn, database, outFile, ctoken);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Skipping database '{Database}' (not dumpable)", database);
            return false;
        }
    }

    private Task PgRestoreAsync(NpgsqlConnectionStringBuilder conn, string database, string dumpFile, CancellationToken ctoken)
        => RunPgToolAsync("pg_restore", conn,
            [
                "-h", conn.Host!, "-p", conn.Port.ToString(), "-U", conn.Username!,
                "-d", database,
                "--clean", "--if-exists", "--no-owner", "--no-privileges",
                dumpFile,
            ],
            conn.Password!, ctoken);

    private async Task RunPgToolAsync(string tool, NpgsqlConnectionStringBuilder conn, string[] args, string password, CancellationToken ctoken)
    {
        var psi = new ProcessStartInfo(tool)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        foreach (var a in args) psi.ArgumentList.Add(a);
        psi.Environment["PGPASSWORD"] = password;

        using var process = Process.Start(psi)
            ?? throw new InvalidOperationException($"Failed to start {tool}.");

        var stderr = await process.StandardError.ReadToEndAsync(ctoken);
        await process.WaitForExitAsync(ctoken);

        if (process.ExitCode != 0)
            throw new InvalidOperationException($"{tool} failed (exit {process.ExitCode}): {stderr}");
    }

    // ---- Small IO helpers ---------------------------------------------------

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

    private static byte[] ReadAllBytes(Stream stream)
    {
        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        return ms.ToArray();
    }

    private static string CreateTempDir()
    {
        var dir = Path.Combine(Path.GetTempPath(), "stigvidd-transfer-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        return dir;
    }

    private void TryDeleteDir(string dir)
    {
        try { if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true); }
        catch (Exception ex) { _logger.LogWarning(ex, "Failed to clean up temp dir {Dir}", dir); }
    }
}
