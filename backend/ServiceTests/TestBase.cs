using Infrastructure.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace ServiceTests;

public abstract class TestBase
{
    protected StigViddDbContext CreateContextAndSqliteDb()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();

        var options = new DbContextOptionsBuilder<StigViddDbContext>()
            .UseSqlite(connection)
            .Options;

        var dbContext = new StigViddDbContext(options);
        dbContext.Database.EnsureCreated();

        Utilities.InitializeDbForTests(dbContext);
        return dbContext;
    }
}
