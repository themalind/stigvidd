// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Services;
using AwesomeAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using System.Security.Cryptography;
using System.Text;

namespace UnitTests.ServiceTests;

/// <summary>
/// The uploaded file is hashed on the way to disk, and the hash is what recognises a
/// re-uploaded export. Run against a real directory: the point of the class is the file.
/// </summary>
public class TrailImportFileStoreTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), $"trail-import-tests-{Guid.NewGuid():N}");

    private TrailImportFileStore CreateStore()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["TrailImport:StoragePath"] = _root })
            .Build();

        return new TrailImportFileStore(configuration, NullLogger<TrailImportFileStore>.Instance);
    }

    private static MemoryStream Content(string text) => new(Encoding.UTF8.GetBytes(text));

    [Fact]
    public async Task SaveAsync_ShouldWriteTheFileAndReportItsHashAndSize()
    {
        // Arrange
        const string json = "{\"type\":\"FeatureCollection\",\"features\":[]}";
        var expected = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(json)));

        // Act
        var stored = await CreateStore().SaveAsync(Content(json), "spar_leder.json", TestContext.Current.CancellationToken);

        // Assert
        File.Exists(stored.StoredPath).Should().BeTrue();
        (await File.ReadAllTextAsync(stored.StoredPath, TestContext.Current.CancellationToken)).Should().Be(json);
        stored.FileHash.Should().Be(expected);
        stored.SizeBytes.Should().Be(Encoding.UTF8.GetByteCount(json));
    }

    [Fact]
    public async Task SaveAsync_ForTheSameContentTwice_ShouldGiveTheSameHashButDifferentFiles()
    {
        // Arrange
        var store = CreateStore();

        // Act
        var first = await store.SaveAsync(Content("{}"), "spar_leder.json", TestContext.Current.CancellationToken);
        var second = await store.SaveAsync(Content("{}"), "spar_leder.json", TestContext.Current.CancellationToken);

        // Assert
        second.FileHash.Should().Be(first.FileHash);
        second.StoredPath.Should().NotBe(first.StoredPath);
    }

    [Fact]
    public async Task SaveAsync_ForAnUploadNameThatIsNotAPlainExtension_ShouldNotLetItDecideThePath()
    {
        // Arrange — the uploaded name is a label, not a location.
        var store = CreateStore();

        // Act
        var stored = await store.SaveAsync(Content("{}"), "../../etc/passwd", TestContext.Current.CancellationToken);

        // Assert
        Path.GetDirectoryName(stored.StoredPath).Should().Be(_root);
        stored.StoredPath.Should().EndWith(".geojson");
    }

    [Fact]
    public async Task Delete_ShouldRemoveTheFile()
    {
        // Arrange
        var store = CreateStore();
        var stored = await store.SaveAsync(Content("{}"), "spar_leder.json", TestContext.Current.CancellationToken);

        // Act
        store.Delete(stored.StoredPath);

        // Assert
        File.Exists(stored.StoredPath).Should().BeFalse();
    }

    [Fact]
    public void Delete_ForAFileThatIsAlreadyGone_ShouldNotThrow()
    {
        // Arrange
        var store = CreateStore();

        // Act
        var deleting = () => store.Delete(Path.Combine(_root, "borta.geojson"));

        // Assert
        deleting.Should().NotThrow();
    }

    public void Dispose()
    {
        if (Directory.Exists(_root))
            Directory.Delete(_root, recursive: true);

        GC.SuppressFinalize(this);
    }
}
