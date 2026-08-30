// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.TrailImport.Source;
using Core.Interfaces.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;

namespace Core.Services;

// Writes uploaded source files to a directory that survives a container restart, and
// hashes them on the way in. Not WebDAV: these are admin working files, not public media,
// and the analysis opens them as ordinary files.
public class TrailImportFileStore : ITrailImportFileStore
{
    private const string DefaultDirectory = "trail-imports";

    private readonly string _root;
    private readonly ILogger<TrailImportFileStore> _logger;

    public TrailImportFileStore(IConfiguration configuration, ILogger<TrailImportFileStore> logger)
    {
        var configured = configuration["TrailImport:StoragePath"];

        _root = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(Path.GetTempPath(), DefaultDirectory)
            : configured;

        _logger = logger;
    }

    public async Task<StoredImportFile> SaveAsync(Stream content, string fileName, CancellationToken ctoken)
    {
        ArgumentNullException.ThrowIfNull(content);

        Directory.CreateDirectory(_root);

        // The uploaded name is only a label; it decides nothing about where the file goes.
        var storedPath = Path.Combine(_root, $"{Guid.NewGuid():N}{SafeExtension(fileName)}");

        long size;

        // Hashed while writing, so a 21 MB export is not read a second time just to
        // recognise it.
        using var sha = SHA256.Create();

        await using (var file = File.Create(storedPath))
        await using (var hashing = new CryptoStream(file, sha, CryptoStreamMode.Write, leaveOpen: true))
        {
            await content.CopyToAsync(hashing, ctoken);
            await hashing.FlushFinalBlockAsync(ctoken);

            size = file.Length;
        }

        return new StoredImportFile(storedPath, Convert.ToHexStringLower(sha.Hash!), size);
    }

    public void Delete(string storedPath)
    {
        try
        {
            if (File.Exists(storedPath))
                File.Delete(storedPath);
        }
        catch (Exception ex)
        {
            // The session row is already gone; a file left behind is untidy, not broken.
            _logger.LogWarning(ex, "TrailImportFileStore: {path} could not be deleted.", storedPath);
        }
    }

    private static string SafeExtension(string fileName)
    {
        var extension = Path.GetExtension(fileName);

        return extension.Length is > 0 and <= 16 && extension.All(c => char.IsLetterOrDigit(c) || c == '.')
            ? extension
            : ".geojson";
    }
}
