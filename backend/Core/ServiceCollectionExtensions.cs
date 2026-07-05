using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Repositories;
using Core.Services;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Net.Http.Headers;
using System.Text;
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
            o.UseNpgsql(connectionString, pgsqlOptions =>
            {
                pgsqlOptions.UseNetTopologySuite();
            });
        });

        // Bra att börja med transient. Märker man att en annan livstid behövs är det lättare att ändra till längre livstid än kortare.
        // Transient: En ny instans skapas varje gång tjänsten begärs. Garbage collected när den inte längre används.

        // Repositories
        // NOTE: IKeycloakUserClient (used by KeycloakAdminRepository) is registered in Program.cs
        // via AddKeycloakAdminHttpClient before AddStigVidd is called.
        services.AddTransient<IKeycloakAdminRepository, KeycloakAdminRepository>();
        services.AddTransient<ITrailRepository, TrailRepository>();
        services.AddTransient<IUserRepository, UserRepository>();
        services.AddTransient<IReviewRepository, ReviewRepository>();
        services.AddTransient<IHikeRepository, HikeRepository>();
        services.AddTransient<ITrailObstacleRepository, TrailObstacleRepository>();
        services.AddTransient<IFacilityRepository, FacilityRepository>();
        services.AddTransient<IHikeShareRepository, HikeShareRepository>();
        services.AddTransient<IHikeShareRecipientRepository, HikeShareRecipientRepository>();
        services.AddTransient<IFriendRepository, FriendRepository>();
        services.AddTransient<IUserPushTokenRepository, UserPushTokenRepository>();
        services.AddTransient<IMediaRepository, MediaRepository>();
        services.AddTransient<ICityAreaRepository, CityAreaRepository>();

        // Services
        services.AddTransient<ITrailService, TrailService>();
        services.AddTransient<IUserService, UserService>();
        services.AddTransient<IReviewService, ReviewService>();
        services.AddTransient<IWebDavService, WebDavService>();
        services.AddTransient<IImageProcessingService, ImageProcessingService>();
        services.AddTransient<IMediaUploadService, MediaUploadService>();
        services.AddTransient<IMediaService, MediaService>();
        services.AddTransient<IHikeService, HikeService>();
        services.AddTransient<ITrailObstaclesService, TrailObstaclesService>();
        services.AddTransient<IFacilityService, FacilityService>();
        services.AddTransient<IHikeShareService, HikeShareService>();
        services.AddTransient<IHikeShareRecipientService, HikeShareRecipientService>();
        services.AddTransient<IFriendService, FriendService>();
        services.AddTransient<ICityAreaService, CityAreaService>();
        services.AddHttpClient<IPushNotificationService, ExpoPushService>(c => c.BaseAddress = new Uri("https://exp.host"));

        services.AddTransient<Func<IWebDavClient>>(sp =>
        {
            var config = sp.GetRequiredService<IConfiguration>();
            var baseUrl = config["WebDav:BaseUrl"] ?? throw new InvalidOperationException("WebDav:BaseUrl configuration is missing");
            var userName = config["WebDav:Username"] ?? throw new InvalidOperationException("WebDav:Username configuration is missing");
            var password = config["WebDav:Password"] ?? throw new InvalidOperationException("WebDav:Password configuration is missing");

            // Preemptive Basic auth: send the Authorization header on the first request instead of
            // waiting for a 401 challenge. The challenge flow resends the request body after the 401,
            // which intermittently gets the connection reset mid-upload on large PUTs.
            var basicAuth = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{userName}:{password}"));

            return () =>
            {
                var httpClient = new HttpClient { BaseAddress = new Uri(baseUrl) };
                httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", basicAuth);

                return new WebDavClient(httpClient);
            };
        });

        // Factories
        services.AddTransient<TrailResponseFactory>();
        services.AddTransient<UserResponseFactory>();
        services.AddTransient<ReviewResponseFactory>();
        services.AddTransient<HikeResponseFactory>();
        services.AddTransient<TrailObstaclesResponseFactory>();
        services.AddTransient<FacilityResponseFactory>();
        services.AddTransient<CityAreaResponseFactory>();
    }
}