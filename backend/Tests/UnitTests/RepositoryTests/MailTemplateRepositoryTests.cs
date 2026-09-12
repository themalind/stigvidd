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
}
