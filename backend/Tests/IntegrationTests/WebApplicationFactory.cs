using Core;
using Core.Interfaces;
using Infrastructure.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using System.Data.Common;
using System.Net.Http.Headers;

namespace IntegrationTests;
// TODO
// https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-9.0&pivots=xunit#mock-authentication
public class StigViddWebApplicationFactory<TProgram>
    : WebApplicationFactory<TProgram> where TProgram : class
{
    private SqliteConnection? _connection;
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            var dbContextDescriptor = services.SingleOrDefault(
                d => d.ServiceType ==
                    typeof(IDbContextOptionsConfiguration<StigViddDbContext>));
            services.Remove(dbContextDescriptor!);

            var dbConnectionDescriptor = services.SingleOrDefault(
                d => d.ServiceType ==
                    typeof(DbConnection));
            services.Remove(dbConnectionDescriptor!);

            _connection = new SqliteConnection("DataSource=:memory:");
            _connection.Open();

            services.AddSingleton<DbConnection>(_connection);

            services.AddDbContextFactory<StigViddDbContext>((container, options) =>
            {
                var connection = container.GetRequiredService<DbConnection>();
                options.UseSqlite(connection);
            });
        });

        // Register test authentication scheme for the test server
        // TODO https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-9.0&pivots=xunit#mock-authentication
        builder.ConfigureTestServices(services =>
        {
            services.AddAuthentication("Test")
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                    "Test", options => { });

            // Prevent real WebDAV network calls during integration tests
            var mockWebDavService = new Mock<IWebDavService>();
            mockWebDavService
                .Setup(x => x.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
                .ReturnsAsync(Result.Ok<string?>("mock/uploaded-file.jpg"));
            mockWebDavService
                .Setup(x => x.DeleteFileAsync(It.IsAny<string>()))
                .ReturnsAsync(Result.Ok(true));

            services.AddSingleton(mockWebDavService.Object);

            // Prevent real Firebase Admin calls during integration tests
            var mockFirebaseAuthService = new Mock<IFirebaseAuthService>();
            mockFirebaseAuthService
                .Setup(x => x.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            services.AddSingleton(mockFirebaseAuthService.Object);
        });

        builder.UseEnvironment("Development");
    }

    // This is called for every HttpClient created by the factory
    // We set the Authorization header to use the test authentication scheme
    protected override void ConfigureClient(HttpClient client)
    {
        base.ConfigureClient(client);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue(scheme: "Test");
    }

    public void SeedDatabase()
    {
        using var scope = Services.CreateScope();
        var factory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<StigViddDbContext>>();
        using var context = factory.CreateDbContext();

        context.Database.EnsureDeleted();
        context.Database.EnsureCreated();

        Utilities.InitializeDbForTests(context);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _connection?.Close();
            _connection?.Dispose();
        }
        base.Dispose(disposing);
    }
}