using Core.Repositories;
using FluentAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using System.Net.Sockets;

namespace UnitTests.RepositoryTests;

/// <summary>
/// The link to the database drops connections at random, so the proposal write is retried.
/// Retrying is safe because the write deletes the session's proposals before adding them,
/// which is also why nothing else in the repository is retried.
/// </summary>
public class TrailImportRepositoryTests
{
    // The real waits add up to just over two minutes, which is right in a background job
    // and wrong in a test.
    private sealed class ImmediateRetry(IDbContextFactory<StigViddDbContext> factory)
        : TrailImportRepository(factory, NullLogger<TrailImportRepository>.Instance)
    {
        protected override Task WaitBeforeRetryAsync(int attempt, CancellationToken ctoken) =>
            Task.CompletedTask;
    }

    private const int Attempts = 5;   // the first try plus four retries

    private static TrailImportProposal Proposal() => new()
    {
        ExternalId = "1",
        FeatureName = "Feature",
        GeometryFingerprint = new string('a', 64),
    };

    private static Mock<IDbContextFactory<StigViddDbContext>> FailingWith(Exception ex)
    {
        var factory = new Mock<IDbContextFactory<StigViddDbContext>>();

        factory.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(ex);

        return factory;
    }

    [Fact]
    public async Task ReplaceProposalsAsync_WhenTheConnectionKeepsDropping_ShouldRetryThenGiveUp()
    {
        // Arrange — the shape a cut connection actually arrives in: the socket error sits
        // several levels down, under EF's own wrapper.
        var factory = FailingWith(new InvalidOperationException("transient failure",
            new IOException("transport", new SocketException(10054))));

        // Act
        var result = await new ImmediateRetry(factory.Object)
            .ReplaceProposalsAsync(12, [Proposal()], CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        factory.Verify(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()), Times.Exactly(Attempts));
    }

    [Fact]
    public async Task ReplaceProposalsAsync_WhenTheReadStalls_ShouldRetry()
    {
        // Arrange — a stalled read looks different from a dropped one and is just as transient.
        var factory = FailingWith(new TimeoutException("Timeout during reading attempt"));

        // Act
        var result = await new ImmediateRetry(factory.Object)
            .ReplaceProposalsAsync(12, [Proposal()], CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        factory.Verify(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()), Times.Exactly(Attempts));
    }

    [Fact]
    public async Task ReplaceProposalsAsync_ForAFailureThatIsNotTransient_ShouldNotRetry()
    {
        // Arrange — same outer type as the transient case, but nothing transport-related
        // underneath. Retrying a broken model or a bad row would only fail four more times.
        var factory = FailingWith(new InvalidOperationException("the model is wrong"));

        // Act
        var result = await new ImmediateRetry(factory.Object)
            .ReplaceProposalsAsync(12, [Proposal()], CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        factory.Verify(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
