// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core;
using Core.Interfaces.Repositories;
using Core.Repositories;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace UnitTests;

public abstract class TestBase
{
    /// <summary>
    /// Creates an isolated in-memory database pre-populated with test data via <see cref="Utilities.InitializeDbForTests"/>.
    /// Pass <paramref name="extraSeed"/> to add entities on top of the standard seed before the factory is returned.
    /// </summary>
    protected static IDbContextFactory<StigViddDbContext> CreateSeededFactory(Action<StigViddDbContext>? extraSeed = null)
    {
        var options = new DbContextOptionsBuilder<StigViddDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        using var seed = new StigViddDbContext(options);
        seed.Database.EnsureCreated();
        Utilities.InitializeDbForTests(seed);

        if (extraSeed != null)
        {
            extraSeed(seed);
            seed.SaveChanges();
        }

        var mock = new Moq.Mock<IDbContextFactory<StigViddDbContext>>();
        mock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new StigViddDbContext(options));
        return mock.Object;
    }

    protected static Task<RepositoryResult<DeletedAccount>> DeleteAccountAsync(IDbContextFactory<StigViddDbContext> factory, string userIdentifier) =>
        new AccountDeletionRepository(factory, Mock.Of<IKeycloakAdminRepository>(), NullLogger<AccountDeletionRepository>.Instance)
            .DeleteAccountAsync(userIdentifier, TestContext.Current.CancellationToken);
}
