// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace UnitTests.ServiceTests;

public class MailOutboxServiceTests
{
    private const string Recipient = "vandrare@example.com";

    // Records what was queued, in order, so a test can assert that a signal was or was not
    // sent without reaching into a Channel.
    private sealed class RecordingQueue : IMailOutboxQueue
    {
        public List<int> Enqueued { get; } = [];

        public void Enqueue(int outboxEmailId) => Enqueued.Add(outboxEmailId);

        public IAsyncEnumerable<int> DequeueAllAsync(CancellationToken ctoken) =>
            throw new NotSupportedException();
    }

    private static MailTemplate MakeTemplate(string language = "sv") => new()
    {
        Key = "welcome",
        Language = language,
        Subject = "Hej {{NickName}}",
        BodyHtml = "<p>Hej {{NickName}}</p>",
        BodyText = "Hej {{NickName}}",
    };

    private static IConfiguration MakeConfiguration(string defaultLanguage = "sv") =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["MailOutbox:DefaultLanguage"] = defaultLanguage })
            .Build();

    private static MailOutboxService Build(
        Mock<IMailTemplateRepository>? templates = null,
        Mock<IMailOutboxRepository>? outbox = null,
        IMailOutboxQueue? queue = null)
    {
        templates ??= TemplateRepoReturning(MakeTemplate());
        outbox ??= OutboxRepoThatSaves();

        return new MailOutboxService(
            templates.Object,
            outbox.Object,
            new MailTemplateRenderer(),
            queue ?? new RecordingQueue(),
            MakeConfiguration(),
            NullLogger<MailOutboxService>.Instance);
    }

    private static Mock<IMailTemplateRepository> TemplateRepoReturning(MailTemplate template)
    {
        var repo = new Mock<IMailTemplateRepository>();
        repo.Setup(r => r.GetByKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<MailTemplate>.Success(template));

        return repo;
    }

    // Mimics the database assigning an id, which is what the queue signal carries.
    private static Mock<IMailOutboxRepository> OutboxRepoThatSaves(int assignedId = 42)
    {
        var repo = new Mock<IMailOutboxRepository>();
        repo.Setup(r => r.AddAsync(It.IsAny<OutboxEmail>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((OutboxEmail email, CancellationToken _) =>
            {
                email.Id = assignedId;
                return RepositoryResult<OutboxEmail>.Success(email);
            });

        return repo;
    }

    private static Dictionary<string, string?> Model(string nickName = "Ralf") =>
        new() { ["NickName"] = nickName };

    [Fact]
    public async Task EnqueueAsync_WhenEverythingIsValid_WritesARenderedPendingRow()
    {
        // Arrange
        var outbox = OutboxRepoThatSaves();
        OutboxEmail? saved = null;
        outbox.Setup(r => r.AddAsync(It.IsAny<OutboxEmail>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((OutboxEmail email, CancellationToken _) =>
            {
                email.Id = 42;
                saved = email;
                return RepositoryResult<OutboxEmail>.Success(email);
            });

        // Act
        var result = await Build(outbox: outbox).EnqueueAsync("welcome", Recipient, Model(), CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        saved.Should().NotBeNull();
        saved.Status.Should().Be(OutboxEmailStatus.Pending);
        saved.TemplateKey.Should().Be("welcome");
        // Rendered at enqueue time, not left as a template for the dispatcher to expand.
        saved.Subject.Should().Be("Hej Ralf");
        saved.BodyHtml.Should().Be("<p>Hej Ralf</p>");
        saved.BodyText.Should().Be("Hej Ralf");
    }

    [Fact]
    public async Task EnqueueAsync_WhenTheRowIsSaved_SignalsTheQueueWithItsId()
    {
        // Arrange
        var queue = new RecordingQueue();

        // Act
        await Build(queue: queue).EnqueueAsync("welcome", Recipient, Model(), CancellationToken.None);

        // Assert
        queue.Enqueued.Should().Equal(42);
    }

    [Fact]
    public async Task EnqueueAsync_SignalsTheQueueOnlyAfterTheRowIsCommitted()
    {
        // Arrange - signalling first would hand the dispatcher an id it cannot read yet.
        var queue = new RecordingQueue();
        var outbox = new Mock<IMailOutboxRepository>();
        var queueWasEmptyDuringSave = false;

        outbox.Setup(r => r.AddAsync(It.IsAny<OutboxEmail>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((OutboxEmail email, CancellationToken _) =>
            {
                queueWasEmptyDuringSave = queue.Enqueued.Count == 0;
                email.Id = 42;
                return RepositoryResult<OutboxEmail>.Success(email);
            });

        // Act
        await Build(outbox: outbox, queue: queue).EnqueueAsync("welcome", Recipient, Model(), CancellationToken.None);

        // Assert
        queueWasEmptyDuringSave.Should().BeTrue();
        queue.Enqueued.Should().Equal(42);
    }

    [Theory]
    // MimeKit's parser accepts the first three as mailboxes with an empty or missing domain,
    // so "did it parse" is not on its own enough to know an address can be submitted.
    [InlineData("not-an-address")]
    [InlineData("vandrare@")]
    [InlineData("@example.com")]
    [InlineData("")]
    [InlineData("   ")]
    public async Task EnqueueAsync_WhenTheAddressCannotBeSubmitted_FailsWithoutWritingOrSignalling(string address)
    {
        // Arrange
        var outbox = OutboxRepoThatSaves();
        var queue = new RecordingQueue();

        // Act
        var result = await Build(outbox: outbox, queue: queue)
            .EnqueueAsync("welcome", address, Model(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(400);
        outbox.Verify(r => r.AddAsync(It.IsAny<OutboxEmail>(), It.IsAny<CancellationToken>()), Times.Never);
        queue.Enqueued.Should().BeEmpty();
    }

    [Fact]
    public async Task EnqueueAsync_WhenTheModelIsMissingAPlaceholder_FailsWithoutWritingOrSignalling()
    {
        // Arrange - a row that can never render is worse than a failure the caller can see.
        var outbox = OutboxRepoThatSaves();
        var queue = new RecordingQueue();
        var model = new Dictionary<string, string?>();

        // Act
        var result = await Build(outbox: outbox, queue: queue)
            .EnqueueAsync("welcome", Recipient, model, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.ResultMessage.Should().Contain("NickName");
        outbox.Verify(r => r.AddAsync(It.IsAny<OutboxEmail>(), It.IsAny<CancellationToken>()), Times.Never);
        queue.Enqueued.Should().BeEmpty();
    }

    [Fact]
    public async Task EnqueueAsync_WhenTheTemplateIsUnknown_Returns404()
    {
        // Arrange
        var templates = new Mock<IMailTemplateRepository>();
        templates.Setup(r => r.GetByKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<MailTemplate>.NotFound());
        var queue = new RecordingQueue();

        // Act
        var result = await Build(templates: templates, queue: queue)
            .EnqueueAsync("no-such-template", Recipient, Model(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
        queue.Enqueued.Should().BeEmpty();
    }

    [Fact]
    public async Task EnqueueAsync_WhenTheTemplateLookupErrors_Returns500()
    {
        // Arrange
        var templates = new Mock<IMailTemplateRepository>();
        templates.Setup(r => r.GetByKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<MailTemplate>.Error());

        // Act
        var result = await Build(templates: templates).EnqueueAsync("welcome", Recipient, Model(), CancellationToken.None);

        // Assert
        result.Message!.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task EnqueueAsync_WhenTheRequestedLanguageIsMissing_FallsBackToTheDefault()
    {
        // Arrange - asked for "en", only "sv" exists.
        var templates = new Mock<IMailTemplateRepository>();
        templates.Setup(r => r.GetByKeyAsync("welcome", "en", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<MailTemplate>.NotFound());
        templates.Setup(r => r.GetByKeyAsync("welcome", "sv", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<MailTemplate>.Success(MakeTemplate()));

        // Act
        var result = await Build(templates: templates)
            .EnqueueAsync("welcome", Recipient, Model(), CancellationToken.None, language: "en");

        // Assert
        result.Success.Should().BeTrue();
        templates.Verify(r => r.GetByKeyAsync("welcome", "sv", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task EnqueueAsync_WhenNoLanguageIsGiven_UsesTheConfiguredDefault()
    {
        // Arrange
        var templates = TemplateRepoReturning(MakeTemplate());

        // Act
        await Build(templates: templates).EnqueueAsync("welcome", Recipient, Model(), CancellationToken.None);

        // Assert
        templates.Verify(r => r.GetByKeyAsync("welcome", "sv", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task EnqueueAsync_WhenTheRowCannotBeSaved_Returns500AndDoesNotSignal()
    {
        // Arrange - nothing durable exists, so a signal would point at nothing.
        var outbox = new Mock<IMailOutboxRepository>();
        outbox.Setup(r => r.AddAsync(It.IsAny<OutboxEmail>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<OutboxEmail>.Error());
        var queue = new RecordingQueue();

        // Act
        var result = await Build(outbox: outbox, queue: queue)
            .EnqueueAsync("welcome", Recipient, Model(), CancellationToken.None);

        // Assert
        result.Message!.StatusCode.Should().Be(500);
        queue.Enqueued.Should().BeEmpty();
    }

    [Fact]
    public async Task EnqueueAsync_WhenARecipientNameIsGiven_KeepsItOnTheRow()
    {
        // Arrange
        OutboxEmail? saved = null;
        var outbox = new Mock<IMailOutboxRepository>();
        outbox.Setup(r => r.AddAsync(It.IsAny<OutboxEmail>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((OutboxEmail email, CancellationToken _) =>
            {
                email.Id = 42;
                saved = email;
                return RepositoryResult<OutboxEmail>.Success(email);
            });

        // Act
        await Build(outbox: outbox).EnqueueAsync("welcome", Recipient, Model(), CancellationToken.None, toName: "Ralf Lindberg");

        // Assert
        saved!.ToName.Should().Be("Ralf Lindberg");
    }
}
