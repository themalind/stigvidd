using Infrastructure.Data;
using MapData;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

internal class Program
{
    // ETL: extract, transform, load.
    // Läsa in json -> extract, översätta till mina entiteter -> transform, spara i db -> load.
    //
    // Each importer is independent and takes one source file, so the tool runs whichever paths
    // it is given and skips the rest. It reports failure through the exit code: it used to
    // construct all three importers, invoke none of them, and print "Färdigt!" regardless,
    // which is worse than failing.
    private static async Task<int> Main(string[] args)
    {
        if (args.Length == 0 || args.Contains("--help") || args.Contains("-h"))
        {
            PrintUsage();
            return args.Length == 0 ? 1 : 0;
        }

        string? trailsPath = null;
        string? facilitiesPath = null;
        string? areasPath = null;

        for (var i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--trails" when i + 1 < args.Length:
                    trailsPath = args[++i];
                    break;
                case "--facilities" when i + 1 < args.Length:
                    facilitiesPath = args[++i];
                    break;
                case "--areas" when i + 1 < args.Length:
                    areasPath = args[++i];
                    break;
                // Reached only when the flag is the last argument, so the `when` guard above
                // failed. Without these the default arm calls a valid flag invalid.
                case "--trails":
                case "--facilities":
                case "--areas":
                    Console.Error.WriteLine($"{args[i]}: värdet saknas — flaggan tar en filväg.");
                    PrintUsage();
                    return 1;
                default:
                    Console.Error.WriteLine($"Ogiltigt argument: {args[i]}");
                    PrintUsage();
                    return 1;
            }
        }

        // Check every named file before opening a connection, so an obvious typo fails before
        // any database work at all. A file that EXISTS but is malformed gets no further than
        // the transaction below.
        foreach (var (flag, path) in new[]
                 {
                     ("--trails", trailsPath),
                     ("--facilities", facilitiesPath),
                     ("--areas", areasPath),
                 })
        {
            if (path is not null && !File.Exists(path))
            {
                Console.Error.WriteLine($"{flag}: filen finns inte: {path}");
                return 1;
            }
        }

        var configuration = new ConfigurationBuilder()
              .AddUserSecrets<Program>()
              .Build();

        var connectionString = configuration.GetConnectionString("StigVidd");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            // The importers write straight to PostGIS, so there is no fallback to fall back to.
            Console.Error.WriteLine(
                "ConnectionStrings:StigVidd saknas. Sätt den i MapData:s user secrets: " +
                "dotnet user-secrets set \"ConnectionStrings:StigVidd\" \"<connection string>\" --project MapData");
            return 1;
        }

        var options = new DbContextOptionsBuilder<StigViddDbContext>()
            .UseNpgsql(connectionString, o => o.UseNetTopologySuite())
            .Options;

        using var context = new StigViddDbContext(options);
        var cancellationToken = new CancellationTokenSource().Token;

        Console.WriteLine("Importerar data...");

        try
        {
            // One transaction across all three importers. Each of them calls SaveChangesAsync
            // itself, so without this a malformed second or third file leaves the earlier
            // imports applied — and the pre-flight check above can only catch a path that is
            // missing outright, not one that parses badly.
            await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);

            if (trailsPath is not null)
            {
                Console.WriteLine($"  leder:       {trailsPath}");
                await new TransmogrifyBorasData(context).TransmogrifyAsync(trailsPath, cancellationToken);
            }

            if (facilitiesPath is not null)
            {
                Console.WriteLine($"  faciliteter: {facilitiesPath}");
                await new FacilityImporter(context).ImportAsync(facilitiesPath, cancellationToken);
            }

            if (areasPath is not null)
            {
                Console.WriteLine($"  områden:     {areasPath}");
                await new CityAreaImporter(context).ImportAsync(areasPath, cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            // Loudly, and with a non-zero exit: a partial import that reports success is the
            // one failure mode worth going out of the way to prevent.
            Console.Error.WriteLine($"Importen misslyckades: {ex.Message}");
            Console.Error.WriteLine(ex);
            return 1;
        }

        Console.WriteLine("Färdigt!");
        return 0;
    }

    private static void PrintUsage()
    {
        Console.WriteLine("""
        Importerar kartdata till StigVidd-databasen. Ange minst en källa.

          dotnet run --project MapData -- [flaggor]

            --trails      <fil>   GeoJSON med leder (Borås Stad-exporten)
            --facilities  <fil>   CSV med grillplatser och vindskydd
            --areas       <fil>   JSON med stadsdelar och deras faciliteter
            -h, --help            visar den här hjälpen

        Anslutningen läses från MapData:s user secrets, ConnectionStrings:StigVidd.
        """);
    }
}
