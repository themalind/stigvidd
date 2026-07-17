using Infrastructure.Data;
using MapData;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

internal class Program
{
    private static async Task Main(string[] args)
    {
        // ETL: extract, transform, load
        // Läsa in json -> extract
        // Översätta till mina entiteter -> transform
        // Spara i db -> load

        var configuration = new ConfigurationBuilder()
              .AddUserSecrets<Program>()
              .Build();

        var connectionString = configuration.GetConnectionString("StigVidd");

        var options = new DbContextOptionsBuilder<StigViddDbContext>()
            .UseNpgsql(connectionString, o => o.UseNetTopologySuite())
            .Options;

        var context = new StigViddDbContext(options);

        var transMogrifier = new TransmogrifyBorasData(context);
        var facilityImporter = new FacilityImporter(context);
        var cityAreaImporter = new CityAreaImporter(context);
        var cancellationToken = new CancellationTokenSource().Token;

        Console.WriteLine("Importerar data...");
    
        Console.WriteLine("Färdigt!");
        Console.ReadLine();
    }
}