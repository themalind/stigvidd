using Core.Factories;
using Core.Interfaces;
using Core.Services;
using FirebaseAdmin;
using FirebaseAdmin.Auth;
using Google.Apis.Auth.OAuth2;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using WebDav;

namespace Core;

public static class ServiceCollectionExtensions
{
    public static void AddStigVidd(this IServiceCollection services, string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new ArgumentNullException(nameof(connectionString), "Connection string cannot be null or empty.");
        }

        services.AddDbContextFactory<StigViddDbContext>(o =>
        {
            o.UseSqlServer(connectionString);
            o.ConfigureWarnings(w =>
            {
                // Reviewed: queries loading multiple collections (TrailImages + TrailLinks/Reviews) are
                // always scoped to a single entity, so the cartesian product is negligible.
                w.Ignore(RelationalEventId.MultipleCollectionIncludeWarning);

                // Reviewed: Take(1) on TrailImages inside projections intentionally fetches any one image,
                // order does not matter here.
                w.Ignore(CoreEventId.RowLimitingOperationWithoutOrderByWarning);

                // Reviewed: EF Core registers SqlQueryRaw<T> result types (PopularTrailQueryResult,
                // TrailShortInfoResponse) as ad-hoc entities at query compile time, bypassing OnModelCreating.
                // All real entity decimal properties have explicit precision configured. This warning
                // only fires for the raw SQL result types where truncation is not a concern.
                w.Ignore(SqlServerEventId.DecimalTypeDefaultWarning);
            });
        });

        // Bra att börja med transient. Märker man att en annan livstid behövs är det lättare att ändra till längre livstid än kortare.
        // Transient: En ny instans skapas varje gång tjänsten begärs. Garbage collected när den inte längre används.

        // Firebase Admin
        services.AddSingleton(sp =>
        {
            var config = sp.GetRequiredService<IConfiguration>();
            var credentialPath = config["Firebase:ServiceAccountPath"]
                ?? throw new InvalidOperationException("Firebase:ServiceAccountPath configuration is missing");

            var app = FirebaseApp.DefaultInstance ?? FirebaseApp.Create(new AppOptions
            {
                Credential = GoogleCredential.FromFile(credentialPath)
            });

            return FirebaseAuth.GetAuth(app);
        });

        // Services
        services.AddTransient<IFirebaseAuthService, FirebaseAuthService>();
        services.AddTransient<ITrailService, TrailService>();
        services.AddTransient<IUserService, UserService>();
        services.AddTransient<IReviewService, ReviewService>();
        services.AddTransient<IWebDavService, WebDavService>();
        services.AddTransient<IHikeService, HikeService>();

        services.AddTransient<Func<IWebDavClient>>(sp =>
        {
            var config = sp.GetRequiredService<IConfiguration>();
            var baseUrl = config["WebDav:BaseUrl"] ?? throw new InvalidOperationException("WebDav:BaseUrl configuration is missing");
            var userName = config["WebDav:Username"] ?? throw new InvalidOperationException("WebDav:Username configuration is missing");
            var password = config["WebDav:Password"] ?? throw new InvalidOperationException("WebDav:Password configuration is missing");

            return () => new WebDavClient(new WebDavClientParams
            {
                BaseAddress = new Uri(baseUrl),
                Credentials = new NetworkCredential(userName, password)
            });
        });

        // Factories
        services.AddTransient<TrailResponseFactory>();
        services.AddTransient<UserFavoritesResponseFactory>();
        services.AddTransient<UserWishlistResponseFactory>();
        services.AddTransient<UserResponseFactory>();
        services.AddTransient<ReviewResponseFactory>();
        services.AddTransient<HikeResponseFactory>();
    }
}

// Extension-metoder används för att utöka IServiceCollection, vilket gör konfigurationen modulär och enkel att hantera.
// Vi kan anropa den på en IServiceCollection-instans som om den var en inbyggd metod.

// AddDbContextFactory<StigViddDbContext>: Registrerar en DbContext Factory, 
// vilket innebär att StigViddDbContext kan skapas vid behov istället för att ha en enda instans per Scoped request.
// Detta ger förbättrad prestanda vid scenarion där DbContext används tillfälligt, t.ex. i bakgrundstjänster.
// Undviker problem med trådhantering i asynkrona operationer.

