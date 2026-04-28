using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace UnitTests;

public abstract class TestBase
{
    protected static IDbContextFactory<StigViddDbContext> CreateSeededFactory()
    {
        var options = new DbContextOptionsBuilder<StigViddDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        using var seed = new StigViddDbContext(options);
        seed.Database.EnsureCreated();
        Utilities.InitializeDbForTests(seed);

        var mock = new Moq.Mock<IDbContextFactory<StigViddDbContext>>();
        mock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new StigViddDbContext(options));
        return mock.Object;
    }
}
