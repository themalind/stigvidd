using Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net;
using WebDav;

namespace Core.Services;

public class WebDavService : IWebDavService
{
    // Skapa klass för dessa?
    private readonly string _baseUrl;
    private readonly string _userName;
    private readonly string _password;
    private readonly ILogger<WebDavService> _logger;

    public WebDavService(IConfiguration configuration, ILogger<WebDavService> logger)
    {

        _baseUrl = configuration["WebDav:BaseUrl"] ?? throw new InvalidOperationException("WebDav:BaseUrl configuration is missing");
        _userName = configuration["WebDav:Username"] ?? throw new InvalidOperationException("WebDav:Username configuration is missing");
        _password = configuration["WebDav:Password"] ?? throw new InvalidOperationException("WebDav:Password configuration is missing");
        _logger = logger;
    }

    private IWebDavClient CreateClient()
    {
        var clientParams = new WebDavClientParams
        {
            BaseAddress = new Uri(_baseUrl),
            Credentials = new NetworkCredential(_userName, _password)
        };

        return new WebDavClient(clientParams);
    }

    // https://github.com/skazantsev/WebDavClient/tree/main/src/WebDav.Client/Request

    public async Task<Result<string?>> UploadFileAsync(Stream stream, string? subDirectory)
    {
        // Skapar en sträng ex "reviews/guid.jpeg"
        var fileName = $"{Guid.NewGuid()}.jpeg";

        var remotePath = subDirectory != null
           ? $"{subDirectory.TrimEnd('/')}/{fileName}"
           : fileName;

        try
        {
            using var client = CreateClient();
            var result = await client.PutFile(remotePath, stream);

            if (!result.IsSuccessful)
            {
                _logger.LogError("UploadFileAsync: Could not upload image {remotePath}", remotePath);

                Result.Fail<string?>(new Message(result.StatusCode, $"UploadFileAsync: Could not upload files. {result.StatusCode}"));
            }

            return Result.Ok<string?>($"{remotePath}");
        }
        catch (Exception ex)
        {
            _logger.LogError("UploadFileAsync: Could not upload image. Threw exception: {ex}", ex);

            throw new Exception("Error uploading file", ex);
        }
    }

    public async Task<Result<bool>> DeleteFileAsync(string relativePath)
    {
        try
        {
            using var client = CreateClient();

            var result = await client.Delete(relativePath); // relativePath ex "reviews/guid.jpeg"

            if (!result.IsSuccessful)
            {
                _logger.LogError("DeleteFileAsync: Could not delete file with path: {relativePath}", relativePath);

                Result.Fail<bool>(new Message(result.StatusCode, $"DeleteFileAsync: Could not delete file"));
            }

            return Result.Ok(result.IsSuccessful);

        }
        catch (Exception ex)
        {
            throw new Exception($"DeleteFileAsync: Error deleting {relativePath}", ex);
        }
    }

    public async Task EnsureDirectoryExistsAsync(string directoryPath)
    {
        using var client = CreateClient();

        var result = await client.Mkcol(directoryPath);

        if (!result.IsSuccessful && result.StatusCode != 405) // 405 = redan finns
        {
            throw new Exception($"Could not create directory: {result.StatusCode}");
        }
    }
}
