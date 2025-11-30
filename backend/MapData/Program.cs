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

        var connectionString = configuration.GetConnectionString("DefaultConnection");

        var options = new DbContextOptionsBuilder<StigViddDbContext>()
            .UseSqlServer(connectionString)
            .Options;

        var context = new StigViddDbContext(options);

        var transMogrifier = new TransmogrifyBorasData(context); 
        var cancellationToken = new CancellationTokenSource().Token;
        await transMogrifier.TransmogrifyAsync("C:\\projekt\\suvnet24\\examensarbete\\stigvidd\\UI\\src\\assets\\spar_leder.json", ct: cancellationToken);
        Console.WriteLine("Färdigt!");
        Console.ReadLine();
    }

}