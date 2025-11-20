using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure;

public static class ServiceCollectionExtensions
{
    public static void AddInfrastructure(this IServiceCollection services, string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new ArgumentNullException(nameof(connectionString), "Connection string cannot be null or empty.");
        }

        services.AddDbContextFactory<StigViddDbContext>(o => o.UseSqlServer(connectionString));

    }
}

// Extension-metoder används för att utöka IServiceCollection, vilket gör konfigurationen modulär och enkel att hantera.
// vilket gör att vi kan anropa den på en IServiceCollection-instans som om den var en inbyggd metod.

// AddDbContextFactory<StigViddDbContext>: Registrerar en DbContext Factory, 
// vilket innebär att StigViddDbContext kan skapas vid behov istället för att ha en enda instans per Scoped request.
// Detta ger förbättrad prestanda vid scenarion där DbContext används tillfälligt, t.ex. i bakgrundstjänster.
// Undviker problem med trådhantering i asynkrona operationer.

