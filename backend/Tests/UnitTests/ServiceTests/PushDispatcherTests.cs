// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Services;
using Core.Services;
using Core.Services.Push;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StigviddAPI.BackgroundServices;

namespace UnitTests.ServiceTests;

public class PushDispatcherTests
{
    private static PushMessage Message(int userId, int? fromUserId = null)
    {
        return new PushMessage([userId], "Titel", "Text", new Dictionary<string, object> { ["type"] = PushTypes.HikeShare }, fromUserId);
    }

    private static (PushDispatcher Dispatcher, PushQueue Queue) Build(Mock<IPushNotificationService> push)
    {
        var services = new ServiceCollection();
        services.AddScoped(_ => push.Object);
        var queue = new PushQueue();

        var dispatcher = new PushDispatcher(
            queue,
            services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>(),
            new MaintenanceGate(),
            NullLogger<PushDispatcher>.Instance);

        return (dispatcher, queue);
    }

    private static async Task WaitUntilAsync(Func<bool> condition)
    {
        var deadline = DateTime.UtcNow.AddSeconds(5);
        while (!condition() && DateTime.UtcNow < deadline)
            await Task.Delay(10, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task SendsAQueuedMessageWithItsSender()
    {
        // Arrange
        var sent = new List<(IReadOnlyCollection<int> UserIds, int? FromUserId)>();
        var push = new Mock<IPushNotificationService>();
        push.Setup(p => p.SendToUsersAsync(
                It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<IReadOnlyDictionary<string, object>>(), It.IsAny<CancellationToken>(), It.IsAny<int?>()))
            .Callback((IReadOnlyCollection<int> ids, string _, string _, IReadOnlyDictionary<string, object> _, CancellationToken _, int? from) => sent.Add((ids, from)))
            .ReturnsAsync(Result.Ok());
        var (dispatcher, queue) = Build(push);

        // Act
        await dispatcher.StartAsync(TestContext.Current.CancellationToken);
        queue.Enqueue(Message(2, fromUserId: 1));
        await WaitUntilAsync(() => sent.Count == 1);
        await dispatcher.StopAsync(TestContext.Current.CancellationToken);

        // Assert
        sent.Should().ContainSingle();
        sent[0].UserIds.Should().Equal(2);
        sent[0].FromUserId.Should().Be(1);
    }

    [Fact]
    public async Task WhenOneSendThrows_TheNextMessageIsStillSent()
    {
        // Arrange
        var sentTo = new List<int>();
        var push = new Mock<IPushNotificationService>();
        push.Setup(p => p.SendToUsersAsync(
                It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<IReadOnlyDictionary<string, object>>(), It.IsAny<CancellationToken>(), It.IsAny<int?>()))
            .Returns((IReadOnlyCollection<int> ids, string _, string _, IReadOnlyDictionary<string, object> _, CancellationToken _, int? _) =>
            {
                if (ids.Contains(2))
                    throw new HttpRequestException("Expo is down");
                sentTo.AddRange(ids);
                return Task.FromResult(Result.Ok());
            });
        var (dispatcher, queue) = Build(push);

        // Act
        await dispatcher.StartAsync(TestContext.Current.CancellationToken);
        queue.Enqueue(Message(2));
        queue.Enqueue(Message(3));
        await WaitUntilAsync(() => sentTo.Count == 1);
        await dispatcher.StopAsync(TestContext.Current.CancellationToken);

        // Assert
        sentTo.Should().Equal(3);
    }
}
