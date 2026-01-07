using Core.Factories;
using Core.Interfaces;
using Core.Services;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Core;

public static class ServiceCollectionExtensions
{
    public static void AddStigVidd(this IServiceCollection services, string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new ArgumentNullException(nameof(connectionString), "Connection string cannot be null or empty.");
        }

        services.AddDbContextFactory<StigViddDbContext>(o => o.UseSqlServer(connectionString));

        // Bra att börja med transient. Märker man att en annan livstid behövs är det lättare att ändra till längre livstid än kortare.
        // Transient: En ny instans skapas varje gång tjänsten begärs. Garbage collected när den inte längre används.

        // Services
        services.AddTransient<ITrailService, TrailService>();
        services.AddTransient<IUserService, UserService>();

        // Factories
        services.AddTransient<TrailResponseFactory>();
        services.AddTransient<UserFavoritesResponseFactory>();
        services.AddTransient<UserWishlistResponseFactory>();
        services.AddTransient<UserResponseFactory>();
    }
}

// Extension-metoder används för att utöka IServiceCollection, vilket gör konfigurationen modulär och enkel att hantera.
// Vi kan anropa den på en IServiceCollection-instans som om den var en inbyggd metod.

// AddDbContextFactory<StigViddDbContext>: Registrerar en DbContext Factory, 
// vilket innebär att StigViddDbContext kan skapas vid behov istället för att ha en enda instans per Scoped request.
// Detta ger förbättrad prestanda vid scenarion där DbContext används tillfälligt, t.ex. i bakgrundstjänster.
// Undviker problem med trådhantering i asynkrona operationer.

