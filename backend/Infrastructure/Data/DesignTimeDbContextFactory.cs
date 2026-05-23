using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Data
{
    // Används bara när man lägger till nya migreringar via command line "dotnet ef migrations add"
    // Anledningen är att det kan vara svårt eller jobbig att komma åt appsettings när man gör detta.
    public class StigViddDbContextFactory : IDesignTimeDbContextFactory<StigViddDbContext>
    {
        public StigViddDbContext CreateDbContext(string[] args)
        {
            var config = new ConfigurationBuilder()
                .AddUserSecrets<StigViddDbContextFactory>()
                .Build();

            var optionsBuilder = new DbContextOptionsBuilder<StigViddDbContext>();
            optionsBuilder.UseNpgsql(config.GetConnectionString("StigVidd"), o =>
            {
                o.UseNetTopologySuite();
            });

            return new StigViddDbContext(optionsBuilder.Options);
        }
    }
}


