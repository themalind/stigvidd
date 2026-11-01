// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Events;
using Core.Interfaces.Repositories;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace UnitTests.Events;

public class DomainEventPublisherTests
{
    [Fact]
    public async Task PublishAsync_StoresTheRowBeforePokingTheSignal()
    {
        var signal = new RecordingSignal();
        var repository = new Mock<IDomainEventRepository>();
        repository.Setup(r => r.AddAsync(It.IsAny<DomainEventRecord>(), It.IsAny<CancellationToken>()))
            .Callback(() => signal.Log.Add("write"))
            .ReturnsAsync((DomainEventRecord record, CancellationToken _) => RepositoryResult<DomainEventRecord>.Success(record));
        var publisher = new DomainEventPublisher(repository.Object, signal, NullLogger<DomainEventPublisher>.Instance);

        var result = await publisher.PublishAsync(new TestPing(7), TestContext.Current.CancellationToken, "user:7");

        result.Success.Should().BeTrue();
        signal.Log.Should().Equal("write", "poke");
    }

    [Fact]
    public async Task PublishAsync_StoresTheStableNameThePayloadAndTheEntityKey()
    {
        DomainEventRecord? stored = null;
        var repository = new Mock<IDomainEventRepository>();
        repository.Setup(r => r.AddAsync(It.IsAny<DomainEventRecord>(), It.IsAny<CancellationToken>()))
            .Callback((DomainEventRecord record, CancellationToken _) => stored = record)
            .ReturnsAsync((DomainEventRecord record, CancellationToken _) => RepositoryResult<DomainEventRecord>.Success(record));
        var publisher = new DomainEventPublisher(repository.Object, new RecordingSignal(), NullLogger<DomainEventPublisher>.Instance);

        await publisher.PublishAsync(new TestPing(7), TestContext.Current.CancellationToken, "user:7");

        stored.Should().NotBeNull();
        stored?.EventType.Should().Be("test.ping");
        stored?.Payload.Should().Be("{\"id\":7}");
        stored?.EntityKey.Should().Be("user:7");
    }

    [Fact]
    public async Task PublishAsync_WhenTheWriteFails_FailsAndNeverPokes()
    {
        var signal = new RecordingSignal();
        var repository = new Mock<IDomainEventRepository>();
        repository.Setup(r => r.AddAsync(It.IsAny<DomainEventRecord>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<DomainEventRecord>.Error());
        var publisher = new DomainEventPublisher(repository.Object, signal, NullLogger<DomainEventPublisher>.Instance);

        var result = await publisher.PublishAsync(new TestPing(7), TestContext.Current.CancellationToken);

        result.Success.Should().BeFalse();
        result.Message?.StatusCode.Should().Be(500);
        signal.Pokes.Should().Be(0);
    }
}
