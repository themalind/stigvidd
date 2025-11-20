using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Infrastructure.Data
{
    // Används bara när man lägger till nya migreringar via command line "dotnet ef migrations add"
    // Anledningen är att det kan vara svårt eller jobbig att komma åt appsettings när man gör detta.
    public class FoodDbContextFactory : IDesignTimeDbContextFactory<StigViddDbContext>
    {
        public StigViddDbContext CreateDbContext(string[] args)
        {
            var optionsBuilder = new DbContextOptionsBuilder<StigViddDbContext>();
            optionsBuilder.UseSqlServer("Server=theresedb.swedencentral.cloudapp.azure.com;Database=FoodService;User Id=therese;Password=RgAgJsLm9J8erj3QD28whc;Encrypt=False;TrustServercertificate=True;");

            return new StigViddDbContext(optionsBuilder.Options);
        }
    }
}
