// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class MailTemplateRepositoryTests : TestBase
{
    private static MailTemplateRepository Build(IDbContextFactory<StigViddDbContext> factory) =>
        new(factory, NullLogger<MailTemplateRepository>.Instance);

    private static MailTemplate MakeTemplate(int id, string key, string language) =>
        new()
        {
            Id = id,
            Identifier = $"template-{id}",
            Key = key,
            Language = language,
            Subject = $"{key} ({language})",
            BodyHtml = "<p>Hej</p>",
            BodyText = "Hej",
            CreatedAt = Utilities.SeedDates.Created,
            LastUpdatedAt = Utilities.SeedDates.Updated,
        };

    private static readonly Action<StigViddDbContext> SeedTemplates = db =>
        db.MailTemplates.AddRange(
            MakeTemplate(1, "welcome", "sv"),
            MakeTemplate(2, "welcome", "en"));

    [Fact]
    public async Task GetByKeyAsync_WhenTheKeyAndLanguageMatch_ReturnsThatTemplate()
    {
        // Arrange
        var repo = Build(CreateSeededFactory(SeedTemplates));

        // Act
        var result = await repo.GetByKeyAsync("welcome", "en", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Language.Should().Be("en");
        result.Value.Subject.Should().Be("welcome (en)");
    }

    [Fact]
    public async Task GetByKeyAsync_WhenOnlyTheLanguageMisses_ReturnsNotFound()
    {
        // Arrange - the fallback to the default language is the service's job, not this one's.
        var repo = Build(CreateSeededFactory(SeedTemplates));

        // Act
        var result = await repo.GetByKeyAsync("welcome", "de", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task GetByKeyAsync_WhenTheKeyIsUnknown_ReturnsNotFound()
    {
        // Arrange
        var repo = Build(CreateSeededFactory(SeedTemplates));

        // Act
        var result = await repo.GetByKeyAsync("no-such-template", "sv", CancellationToken.None);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsEveryTemplate_OrderedByKeyThenLanguage()
    {
        // Arrange
        var repo = Build(CreateSeededFactory(db => db.MailTemplates.AddRange(
            MakeTemplate(1, "welcome", "sv"),
            MakeTemplate(2, "verify-email", "sv"),
            MakeTemplate(3, "welcome", "en"))));

        // Act
        var result = await repo.GetAllAsync(CancellationToken.None);

        // Assert - the languages of one template stay together in the list an operator reads.
        result.IsSuccess.Should().BeTrue();
        result.Value!.Select(template => $"{template.Key}/{template.Language}")
            .Should().Equal("verify-email/sv", "welcome/en", "welcome/sv");
    }

    [Fact]
    public async Task GetByIdentifierAsync_FindsTheRow()
    {
        var repo = Build(CreateSeededFactory(SeedTemplates));

        var result = await repo.GetByIdentifierAsync("template-2", CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Language.Should().Be("en");
    }

    [Fact]
    public async Task GetByIdentifierAsync_WhenNothingMatches_ReturnsNotFound()
    {
        var repo = Build(CreateSeededFactory(SeedTemplates));

        var result = await repo.GetByIdentifierAsync("template-404", CancellationToken.None);

        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task UpdateAsync_ActuallyPersists()
    {
        // The one that matters. Every read in this repository is AsNoTracking, and an
        // untracked entity is not in the change tracker -- so an update written the same way
        // would call SaveChangesAsync, report success, and write nothing at all.
        var factory = CreateSeededFactory(SeedTemplates);
        var repo = Build(factory);

        var result = await repo.UpdateAsync(
            "template-1", "Ny rubrik", "<p>Ny</p>", "Ny", "Uppdaterad.", CancellationToken.None);

        result.IsSuccess.Should().BeTrue();

        // Read it back through a NEW context, not the returned entity: the returned object
        // would look updated whether or not anything reached the database.
        using var context = await factory.CreateDbContextAsync(CancellationToken.None);
        var reloaded = await context.MailTemplates.AsNoTracking()
            .FirstAsync(template => template.Identifier == "template-1", CancellationToken.None);

        reloaded.Subject.Should().Be("Ny rubrik");
        reloaded.BodyHtml.Should().Be("<p>Ny</p>");
        reloaded.BodyText.Should().Be("Ny");
        reloaded.Description.Should().Be("Uppdaterad.");
    }

    [Fact]
    public async Task UpdateAsync_LeavesTheKeyAndLanguageAlone()
    {
        // They are what the calling C# passes to the outbox: change either and the mail stops
        // being found. The signature does not accept them; this pins that it stays that way.
        var factory = CreateSeededFactory(SeedTemplates);

        await Build(factory).UpdateAsync(
            "template-1", "Ny rubrik", "<p>Ny</p>", "Ny", null, CancellationToken.None);

        using var context = await factory.CreateDbContextAsync(CancellationToken.None);
        var reloaded = await context.MailTemplates.AsNoTracking()
            .FirstAsync(template => template.Identifier == "template-1", CancellationToken.None);

        reloaded.Key.Should().Be("welcome");
        reloaded.Language.Should().Be("sv");
    }

    [Fact]
    public async Task UpdateAsync_StampsLastUpdatedAt()
    {
        var factory = CreateSeededFactory(SeedTemplates);

        var before = DateTime.UtcNow;
        await Build(factory).UpdateAsync(
            "template-1", "Ny", "<p>Ny</p>", "Ny", null, CancellationToken.None);

        using var context = await factory.CreateDbContextAsync(CancellationToken.None);
        var reloaded = await context.MailTemplates.AsNoTracking()
            .FirstAsync(template => template.Identifier == "template-1", CancellationToken.None);

        reloaded.LastUpdatedAt.Should().BeOnOrAfter(before);
    }

    [Fact]
    public async Task UpdateAsync_WhenTheTemplateIsGone_ReturnsNotFoundRatherThanCreatingOne()
    {
        var repo = Build(CreateSeededFactory(SeedTemplates));

        var result = await repo.UpdateAsync(
            "template-404", "x", "<p>x</p>", "x", null, CancellationToken.None);

        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }
}
