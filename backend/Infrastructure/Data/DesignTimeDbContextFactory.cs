using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Infrastructure.Data
{
    // Används bara när man lägger till nya migreringar via command line "dotnet ef migrations add"
    // Anledningen är att det kan vara svårt eller jobbig att komma åt appsettings när man gör detta.
    public class StigViddDbContextFactory : IDesignTimeDbContextFactory<StigViddDbContext>
    {
        public StigViddDbContext CreateDbContext(string[] args)
        {
            var optionsBuilder = new DbContextOptionsBuilder<StigViddDbContext>();
            optionsBuilder.UseSqlServer("");

            return new StigViddDbContext(optionsBuilder.Options);
        }
    }
}


