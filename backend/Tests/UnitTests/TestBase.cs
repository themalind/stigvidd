using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
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
}
