// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Text.Json;

namespace Core.Services.DataTransfer;

public record DataTransferManifest
{
    // Bump when the archive layout changes in an incompatible way. keep-comment: compatibility contract
    public const int CurrentFormatVersion = 2;

    public int FormatVersion { get; init; }
    public DateTimeOffset ExportedAtUtc { get; init; }
    public bool IncludesKeycloak { get; init; }
    public bool Anonymized { get; init; }
    public string? LatestMigration { get; init; }
    public int MediaExported { get; init; }
    public int MediaMissing { get; init; }
    public int TrailImportFiles { get; init; }

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static DataTransferManifest Parse(Stream stream)
    {
        try
        {
            return JsonSerializer.Deserialize<DataTransferManifest>(stream, Json)
                ?? throw new InvalidOperationException("Not a valid export archive (empty manifest.json).");
        }
        catch (JsonException)
        {
            throw new InvalidOperationException("Not a valid export archive (unreadable manifest.json).");
        }
    }

    public byte[] ToJson() => JsonSerializer.SerializeToUtf8Bytes(this, Json);
}
