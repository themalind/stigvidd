// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Services;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StigviddAPI;

namespace IntegrationTests.Mail;

/// <summary>
/// The outbox against the real host and a real database. There is no HTTP surface for mail
/// (deliberately — nothing calls it yet), so these resolve the service the way a future
/// caller would and assert on what lands in the table.
/// </summary>
public class MailOutboxIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string TemplateKey = "welcome";
    private const string Recipient = "vandrare@example.com";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public MailOutboxIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
        SeedTemplate();
    }

    // The production template arrives via the migration's InsertData, and no test applies a
    // migration — the suite builds its schema with EnsureCreated. So the fixture seeds its own.
    private void SeedTemplate()
    {
        using var scope = _factory.Services.CreateScope();
        using var db = scope.ServiceProvider
            .GetRequiredService<IDbContextFactory<StigViddDbContext>>()
            .CreateDbContext();

        if (db.MailTemplates.Any(t => t.Key == TemplateKey && t.Language == "sv"))
            return;

        db.MailTemplates.Add(new MailTemplate
        {
            Key = TemplateKey,
            Language = "sv",
            Subject = "Välkommen till Stigvidd, {{NickName}}!",
            BodyHtml = "<p>Hej {{NickName}},</p>",
            BodyText = "Hej {{NickName}},",
        });

        db.SaveChanges();
    }

    private IMailOutboxService Outbox(IServiceScope scope) =>
        scope.ServiceProvider.GetRequiredService<IMailOutboxService>();

    private static StigViddDbContext Db(IServiceScope scope) =>
        scope.ServiceProvider.GetRequiredService<IDbContextFactory<StigViddDbContext>>().CreateDbContext();

    [Fact]
    public async Task EnqueueAsync_WritesAPendingRowWithTheTemplateAlreadyRendered()
    {
        // Arrange
        using var scope = _factory.Services.CreateScope();
        var model = new Dictionary<string, string?> { ["NickName"] = "Ralf" };

        // Act
        var result = await Outbox(scope).EnqueueAsync(TemplateKey, Recipient, model, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNullOrWhiteSpace();

        using var db = Db(scope);
        var stored = db.OutboxEmails.Single(e => e.Identifier == result.Value);

        stored.Status.Should().Be(OutboxEmailStatus.Pending);
        stored.ToAddress.Should().Be(Recipient);
        stored.TemplateKey.Should().Be(TemplateKey);
        stored.Attempts.Should().Be(0);
        stored.SentAt.Should().BeNull();

        // Rendered at enqueue: no placeholder survives into the row.
        stored.Subject.Should().Be("Välkommen till Stigvidd, Ralf!");
        stored.BodyHtml.Should().Be("<p>Hej Ralf,</p>");
        stored.BodyText.Should().Be("Hej Ralf,");
        stored.BodyHtml.Should().NotContain("{{");
    }

    [Fact]
    public async Task EnqueueAsync_WhenTheTemplateIsUnknown_WritesNothing()
    {
        // Arrange
        using var scope = _factory.Services.CreateScope();
        using var before = Db(scope);
        var countBefore = before.OutboxEmails.Count();

        // Act
        var result = await Outbox(scope).EnqueueAsync(
            "no-such-template", Recipient, new Dictionary<string, string?>(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);

        using var after = Db(scope);
        after.OutboxEmails.Count().Should().Be(countBefore);
    }

    [Fact]
    public async Task EnqueueAsync_WhenTheModelIsMissingAPlaceholder_WritesNothing()
    {
        // Arrange - the whole point of rendering at enqueue: this is reported to a caller
        // rather than discovered by a background loop with nobody listening.
        using var scope = _factory.Services.CreateScope();
        using var before = Db(scope);
        var countBefore = before.OutboxEmails.Count();

        // Act
        var result = await Outbox(scope).EnqueueAsync(
            TemplateKey, Recipient, new Dictionary<string, string?>(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.ResultMessage.Should().Contain("NickName");

        using var after = Db(scope);
        after.OutboxEmails.Count().Should().Be(countBefore);
    }

    [Fact]
    public async Task Enqueue_ThenClaim_MakesASecondClaimANoOp()
    {
        // Arrange - the duplicate-signal path, end to end against a real database. A mail
        // that is claimed twice is a mail that is sent twice.
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<Core.Interfaces.Repositories.IMailOutboxRepository>();
        var model = new Dictionary<string, string?> { ["NickName"] = "Ralf" };

        var enqueued = await Outbox(scope).EnqueueAsync(TemplateKey, Recipient, model, CancellationToken.None);

        using var db = Db(scope);
        var id = db.OutboxEmails.Single(e => e.Identifier == enqueued.Value).Id;

        // Act
        var first = await repository.ClaimAsync(id, CancellationToken.None);
        var second = await repository.ClaimAsync(id, CancellationToken.None);

        // Assert
        first.IsSuccess.Should().BeTrue();
        first.Value!.Status.Should().Be(OutboxEmailStatus.Sending);
        second.Status.Should().Be(RepositoryResultStatus.Conflict);
    }

    [Fact]
    public async Task ResetInterrupted_ThenGetPendingIds_RecoversAMailLeftSendingByARestart()
    {
        // Arrange - exactly what MailOutboxDispatcher does on start. The row was claimed and
        // the process died; nothing in memory remembers it.
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<Core.Interfaces.Repositories.IMailOutboxRepository>();
        var model = new Dictionary<string, string?> { ["NickName"] = "Ralf" };

        var enqueued = await Outbox(scope).EnqueueAsync(TemplateKey, Recipient, model, CancellationToken.None);

        using var db = Db(scope);
        var id = db.OutboxEmails.Single(e => e.Identifier == enqueued.Value).Id;
        await repository.ClaimAsync(id, CancellationToken.None);

        // Act
        await repository.ResetInterruptedAsync(CancellationToken.None);
        var pending = await repository.GetPendingIdsAsync(CancellationToken.None);

        // Assert
        pending.IsSuccess.Should().BeTrue();
        pending.Value.Should().Contain(id);
    }
}
