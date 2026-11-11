// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.DomainEvents;
using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using StigviddAPI;

namespace IntegrationTests.DomainEvents;

[DomainEventName("integration.ping")]
public sealed record IntegrationPing(int Id) : IDomainEvent;

public sealed class RecordingPingHandler : IDomainEventHandler<IntegrationPing>
{
    public List<IntegrationPing> Seen { get; } = [];

    public Task<Result> HandleAsync(IntegrationPing @event, CancellationToken ctoken)
    {
        Seen.Add(@event);
        return Task.FromResult(Result.Ok());
    }
}

public class DomainEventIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    public DomainEventIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private WebApplicationFactory<Program> WithPingRegistered(RecordingPingHandler handler)
    {
        var derived = _factory.WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<DomainEventRegistry>();
                services.AddSingleton(DomainEventRegistry.FromTypes([typeof(IntegrationPing)]));
                services.AddSingleton<IDomainEventHandler<IntegrationPing>>(handler);
            }));

        using var scope = derived.Services.CreateScope();
        var contextFactory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<StigViddDbContext>>();
        using var context = contextFactory.CreateDbContext();
        context.Database.EnsureDeleted();
        context.Database.EnsureCreated();

        return derived;
    }

    private static async Task<DomainEventRecord> SingleRowAsync(WebApplicationFactory<Program> host)
    {
        var contextFactory = host.Services.GetRequiredService<IDbContextFactory<StigViddDbContext>>();
        await using var db = await contextFactory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        return await db.DomainEvents.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task APublishedEvent_IsStoredThenHandledByTheRegisteredHandler()
    {
        var handler = new RecordingPingHandler();
        using var host = WithPingRegistered(handler);

        using (var scope = host.Services.CreateScope())
        {
            var published = await scope.ServiceProvider.GetRequiredService<IDomainEventPublisher>()
                .PublishAsync(new IntegrationPing(7), TestContext.Current.CancellationToken, "user:7");
            published.Success.Should().BeTrue();
        }

        var pending = await SingleRowAsync(host);
        pending.Status.Should().Be(DomainEventStatus.Pending);
        pending.EventType.Should().Be("integration.ping");
        pending.EntityKey.Should().Be("user:7");
        pending.Payload.Should().Be("{\"id\":7}");

        using (var scope = host.Services.CreateScope())
        {
            var due = await scope.ServiceProvider.GetRequiredService<IDomainEventProcessor>()
                .ProcessDueAsync(10, TestContext.Current.CancellationToken);
            due.Should().Be(1);
        }

        handler.Seen.Should().Equal(new IntegrationPing(7));
        var handled = await SingleRowAsync(host);
        handled.Status.Should().Be(DomainEventStatus.Handled);
        handled.SettledAt.Should().NotBeNull();
        handled.CompletedHandlers.Should().Contain(typeof(RecordingPingHandler).FullName);
    }

    [Fact]
    public async Task APendingRowLeftByAnEarlierRun_IsPickedUpOnTheNextPass()
    {
        var handler = new RecordingPingHandler();
        using var host = WithPingRegistered(handler);

        var contextFactory = host.Services.GetRequiredService<IDbContextFactory<StigViddDbContext>>();
        await using (var db = await contextFactory.CreateDbContextAsync(TestContext.Current.CancellationToken))
        {
            db.DomainEvents.Add(new DomainEventRecord
            {
                EventType = "integration.ping", Payload = "{\"id\":9}", Status = DomainEventStatus.Processing,
                NextAttemptAt = DateTime.UtcNow.AddMinutes(-5),
            });
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        using (var scope = host.Services.CreateScope())
        {
            var repository = scope.ServiceProvider.GetRequiredService<IDomainEventRepository>();
            await repository.ResetInterruptedAsync(5, TestContext.Current.CancellationToken);
            await scope.ServiceProvider.GetRequiredService<IDomainEventProcessor>()
                .ProcessDueAsync(10, TestContext.Current.CancellationToken);
        }

        handler.Seen.Should().Equal(new IntegrationPing(9));
        (await SingleRowAsync(host)).Status.Should().Be(DomainEventStatus.Handled);
    }

    [Fact]
    public async Task PurgeSettledBeforeAsync_DeletesOnlyOldSettledRows()
    {
        using var host = WithPingRegistered(new RecordingPingHandler());
        var old = DateTime.UtcNow.AddDays(-120);
        var recent = DateTime.UtcNow.AddDays(-10);

        var contextFactory = host.Services.GetRequiredService<IDbContextFactory<StigViddDbContext>>();
        await using (var db = await contextFactory.CreateDbContextAsync(TestContext.Current.CancellationToken))
        {
            DomainEventRecord Make(DomainEventStatus status, DateTime? settledAt) => new()
            {
                EventType = "integration.ping", Payload = "{\"id\":1}", Status = status,
                NextAttemptAt = old, SettledAt = settledAt,
            };

            db.DomainEvents.AddRange(
                Make(DomainEventStatus.Handled, old),
                Make(DomainEventStatus.Failed, old),
                Make(DomainEventStatus.Handled, recent),
                Make(DomainEventStatus.Pending, null),
                Make(DomainEventStatus.Processing, null));
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        int deleted;
        using (var scope = host.Services.CreateScope())
        {
            var result = await scope.ServiceProvider.GetRequiredService<IDomainEventRepository>()
                .PurgeSettledBeforeAsync(DateTime.UtcNow.AddDays(-90), TestContext.Current.CancellationToken);
            result.IsSuccess.Should().BeTrue();
            deleted = result.Value;
        }

        deleted.Should().Be(2);
        await using var check = await contextFactory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var remaining = await check.DomainEvents.Select(e => e.Status).ToListAsync(TestContext.Current.CancellationToken);
        remaining.Should().BeEquivalentTo([DomainEventStatus.Handled, DomainEventStatus.Pending, DomainEventStatus.Processing]);
    }
}
