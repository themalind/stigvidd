// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using StigviddAPI;
using System.Net;

namespace IntegrationTests.OpenApiContract;

// The web admin client under web/src/api/generated is generated from this document.
// web/openapi.json is NOT committed (it is gitignored): this test is what produces it, so
// `npm run generate:api` has an input without a running API. A checkout that has never run
// the backend tests therefore has no snapshot, and that is not a failure - it is written
// and the test passes. Only a snapshot that exists and DISAGREES fails, because then the
// committed client under web/src/api/generated is the thing that has gone stale.
public class OpenApiContractTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string SnapshotRelativePath = "web/openapi.json";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public OpenApiContractTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task OpenApiDocument_MatchesTheGeneratedSnapshot()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/swagger/v1/swagger.json", TestContext.Current.CancellationToken);
        var current = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var snapshotPath = Path.Combine(FindRepositoryRoot(), SnapshotRelativePath);
        var existing = File.Exists(snapshotPath)
            ? await File.ReadAllTextAsync(snapshotPath, TestContext.Current.CancellationToken)
            : null;

        // Ordinal, so line endings count: on Windows this always fails against the LF snapshot.
        // See docs/notes/openapi-snapshot-fails-on-windows-line-endings.md.
        if (string.Equals(existing, current, StringComparison.Ordinal))
            return;

        await File.WriteAllTextAsync(snapshotPath, current, TestContext.Current.CancellationToken);

        // No snapshot yet - a fresh clone, or one that has just been cleaned. There is
        // nothing to have drifted from, so writing it IS the job and the run stays green.
        if (existing is null)
            return;

        // A snapshot that exists and disagrees means the surface moved under a client that
        // was generated from the old document. That client IS committed, so it has to be
        // regenerated; this is the one case worth stopping for.
        Assert.Fail(
            $"The API contract changed and {SnapshotRelativePath} has been rewritten. " +
            "Run `npm run generate:api` in web/ and commit web/src/api/generated.");
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);

        while (directory != null)
        {
            // A file OR a directory: in a linked git worktree `.git` is a FILE holding a
            // `gitdir:` pointer, not a directory. Testing only for a directory walked
            // straight past the worktree root and off the top of the filesystem, so this
            // threw and made the whole integration suite unrunnable in a worktree - which
            // is the checkout the work is normally done in.
            var dotGit = Path.Combine(directory.FullName, ".git");
            if (Directory.Exists(dotGit) || File.Exists(dotGit))
                return directory.FullName;

            directory = directory.Parent;
        }

        throw new InvalidOperationException("Could not locate the repository root from " + AppContext.BaseDirectory);
    }
}
