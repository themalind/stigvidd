// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using StigviddAPI;
using System.Net;

namespace IntegrationTests.OpenApiContract;

// The web admin client under web/src/api/generated is generated from this document.
// Keeping a copy in the repo lets CI regenerate without a running API.
public class OpenApiContractTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string SnapshotRelativePath = "web/openapi.json";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public OpenApiContractTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task OpenApiDocument_MatchesTheCommittedSnapshot()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/swagger/v1/swagger.json", TestContext.Current.CancellationToken);
        var current = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var snapshotPath = Path.Combine(FindRepositoryRoot(), SnapshotRelativePath);
        var committed = File.Exists(snapshotPath)
            ? await File.ReadAllTextAsync(snapshotPath, TestContext.Current.CancellationToken)
            : null;

        // Ordinal, so line endings count: on Windows this always fails against the LF snapshot.
        // See docs/notes/openapi-snapshot-fails-on-windows-line-endings.md.
        if (string.Equals(committed, current, StringComparison.Ordinal))
            return;

        // Written on mismatch so the fix locally is to rerun generation and commit both files.
        await File.WriteAllTextAsync(snapshotPath, current, TestContext.Current.CancellationToken);

        Assert.Fail(
            $"The API contract changed and {SnapshotRelativePath} has been rewritten. " +
            "Review it, run `npm run generate:api` in web/, and commit both.");
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
