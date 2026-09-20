// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using WebDataContracts.RequestModels.MailOutbox;

namespace UnitTests.ServiceTests;

public class MailOutboxAdminServiceTests
{
    // Records what was signalled, in order, so a test can assert that a signal was or was not
    // sent without reaching into a Channel.
    private sealed class RecordingQueue : IMailOutboxQueue
    {
        public List<int> Enqueued { get; } = [];

        public void Enqueue(int outboxEmailId) => Enqueued.Add(outboxEmailId);

        public IAsyncEnumerable<int> DequeueAllAsync(CancellationToken ctoken) =>
            throw new NotSupportedException();
    }

    private static OutboxEmail MakeEmail(
        OutboxEmailStatus status = OutboxEmailStatus.Pending,
        DateTime? redactedAt = null) => new()
    {
        Id = 42,
        Identifier = "mail-42",
        ToAddress = "vandrare@example.com",
        Subject = "Hej",
        BodyHtml = redactedAt is null ? "<p>Hej</p>" : string.Empty,
        BodyText = redactedAt is null ? "Hej" : string.Empty,
        TemplateKey = "welcome",
        Status = status,
        RedactedAt = redactedAt,
    };

    private static MailOutboxAdminService Build(
        Mock<IMailOutboxRepository> repository, IMailOutboxQueue queue) =>
        new(repository.Object,
            queue,
            new MailOutboxResponseFactory(),
            NullLogger<MailOutboxAdminService>.Instance);

    [Fact]
    public async Task RetryAsync_SignalsTheQueueWithTheRowsIdOnlyAfterTheRepositoryCommitted()
    {
        // The ordering rule the whole outbox rests on. Signalling before the row is written
        // hands the dispatcher an id whose row is still Failed: ClaimAsync reports Conflict,
        // the work is dropped, and nothing will ever signal it again.
        // Arrange
        var queue = new RecordingQueue();
        var repository = new Mock<IMailOutboxRepository>();
        var signalledDuringWrite = new List<int>();

        repository
            .Setup(r => r.RequeueAsync("mail-42", It.IsAny<CancellationToken>()))
            .ReturnsAsync(() =>
            {
                // Whatever the queue holds at this instant is what was signalled BEFORE the
                // write returned. It must be empty.
                signalledDuringWrite.AddRange(queue.Enqueued);
                return RepositoryResult<OutboxEmail>.Success(MakeEmail(OutboxEmailStatus.Pending));
            });

        var service = Build(repository, queue);

        // Act
        var result = await service.RetryAsync("mail-42", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        signalledDuringWrite.Should().BeEmpty("the signal must come strictly after the commit");
        queue.Enqueued.Should().BeEquivalentTo([42]);
    }

    [Theory]
    [InlineData(RepositoryResultStatus.Conflict, 409)]
    [InlineData(RepositoryResultStatus.NotFound, 404)]
    [InlineData(RepositoryResultStatus.Error, 500)]
    public async Task RetryAsync_WhenTheRepositoryRefuses_DoesNotSignalTheQueue(
        RepositoryResultStatus status, int expectedStatusCode)
    {
        // A signal for a row that was not requeued is a dispatcher wake-up for nothing at best,
        // and at worst hides that the retry silently failed.
        // Arrange
        var queue = new RecordingQueue();
        var repository = new Mock<IMailOutboxRepository>();

        repository
            .Setup(r => r.RequeueAsync("mail-42", It.IsAny<CancellationToken>()))
            .ReturnsAsync(status switch
            {
                RepositoryResultStatus.Conflict => RepositoryResult<OutboxEmail>.Conflict(),
                RepositoryResultStatus.NotFound => RepositoryResult<OutboxEmail>.NotFound(),
                _ => RepositoryResult<OutboxEmail>.Error(),
            });

        var service = Build(repository, queue);

        // Act
        var result = await service.RetryAsync("mail-42", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(expectedStatusCode);
        queue.Enqueued.Should().BeEmpty();
    }

    [Fact]
    public async Task GetBodyAsync_ReturnsTheRenderedBodies()
    {
        // Arrange
        var repository = new Mock<IMailOutboxRepository>();
        repository
            .Setup(r => r.GetByIdentifierAsync("mail-42", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<OutboxEmail>.Success(MakeEmail()));

        var service = Build(repository, new RecordingQueue());

        // Act
        var result = await service.GetBodyAsync("mail-42", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.BodyHtml.Should().Be("<p>Hej</p>");
    }

    [Fact]
    public async Task GetBodyAsync_ForARedactedMail_IsANotFoundThatSaysWhy()
    {
        // 404 rather than an empty body. An empty body is indistinguishable from a render that
        // went wrong, and would send the operator looking for a bug instead of reading the rule.
        // Arrange
        var repository = new Mock<IMailOutboxRepository>();
        repository
            .Setup(r => r.GetByIdentifierAsync("mail-42", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<OutboxEmail>.Success(
                MakeEmail(OutboxEmailStatus.Failed, redactedAt: DateTime.UtcNow)));

        var service = Build(repository, new RecordingQueue());

        // Act
        var result = await service.GetBodyAsync("mail-42", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Contain("retention");
    }

    [Fact]
    public async Task RetryAsync_WhenRefused_SaysBothReasonsRatherThanOnlyTheTemporaryOne()
    {
        // RepositoryResultStatus has five values and no way to say "conflict because redacted",
        // so retry and redaction come back as the same Conflict. If the message only mentions
        // mail that is being sent right now, an operator whose mail was redacted is told to try
        // again in a moment -- when the answer is never. The status code alone cannot catch
        // this, which is why the text is asserted.
        // Arrange
        var repository = new Mock<IMailOutboxRepository>();
        repository
            .Setup(r => r.RequeueAsync("mail-42", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<OutboxEmail>.Conflict());

        var service = Build(repository, new RecordingQueue());

        // Act
        var result = await service.RetryAsync("mail-42", TestContext.Current.CancellationToken);

        // Assert
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.ResultMessage.Should().Contain("retention");
    }

    [Fact]
    public async Task CancelAsync_NeverSignalsTheQueue()
    {
        // Cancelling removes work; there is nothing for the dispatcher to look at. A signal
        // already sitting in the channel is harmless because claiming guards on Pending.
        // Arrange
        var queue = new RecordingQueue();
        var repository = new Mock<IMailOutboxRepository>();

        repository
            .Setup(r => r.CancelAsync("mail-42", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<OutboxEmail>.Success(MakeEmail(OutboxEmailStatus.Cancelled)));

        var service = Build(repository, queue);

        // Act
        var result = await service.CancelAsync("mail-42", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        queue.Enqueued.Should().BeEmpty();
    }

    [Fact]
    public async Task CancelAsync_WhenTheRowIsNotPending_Is409()
    {
        // Arrange
        var repository = new Mock<IMailOutboxRepository>();
        repository
            .Setup(r => r.CancelAsync("mail-42", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<OutboxEmail>.Conflict());

        var service = Build(repository, new RecordingQueue());

        // Act
        var result = await service.CancelAsync("mail-42", TestContext.Current.CancellationToken);

        // Assert
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task GetPagedAsync_WithAnUnknownStatus_Is400AndNeverTouchesTheRepository()
    {
        // Ignoring the filter instead would show a full outbox as an empty one, which is the
        // worst answer this endpoint could give.
        // Arrange
        var repository = new Mock<IMailOutboxRepository>(MockBehavior.Strict);
        var service = Build(repository, new RecordingQueue());

        // Act
        var result = await service.GetPagedAsync(
            "Panding", null, null, 1, 25, TestContext.Current.CancellationToken);

        // Assert
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
        result.Message.ResultMessage.Should().Contain("Pending");
    }

    [Fact]
    public async Task GetPagedAsync_ClampsPageAndPageSize()
    {
        // A missing page binds to 0, and Skip((0 - 1) * size) is a negative Skip.
        // Arrange
        var repository = new Mock<IMailOutboxRepository>();
        repository
            .Setup(r => r.GetPagedAsync(
                null, null, null, It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<PagedResult<OutboxEmailSummary>>.Success(
                new PagedResult<OutboxEmailSummary>([], 1, false, 0)));

        var service = Build(repository, new RecordingQueue());

        // Act
        await service.GetPagedAsync(null, null, null, 0, 0, TestContext.Current.CancellationToken);

        // Assert
        repository.Verify(
            r => r.GetPagedAsync(null, null, null, 1, 25, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task PurgeAsync_AsksForACutoffTheRequestedNumberOfDaysBack()
    {
        // Arrange
        var repository = new Mock<IMailOutboxRepository>();
        var asked = DateTime.MinValue;

        repository
            .Setup(r => r.PurgeSentBeforeAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .Callback((DateTime cutoff, CancellationToken _) => asked = cutoff)
            .ReturnsAsync(RepositoryResult<int>.Success(3));

        var service = Build(repository, new RecordingQueue());

        // Act
        var result = await service.PurgeAsync(
            new PurgeMailOutboxRequest { OlderThanDays = 30, Confirm = true },
            TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Deleted.Should().Be(3);
        asked.Should().BeCloseTo(DateTime.UtcNow.AddDays(-30), TimeSpan.FromMinutes(1));
    }
}
