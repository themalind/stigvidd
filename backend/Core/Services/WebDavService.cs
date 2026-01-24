using Core.Interfaces;
using Microsoft.Extensions.Configuration;
using System.Net;
using WebDav;

namespace Core.Services;

public class WebDavService : IWebDavService
{
    // Skapa klass för dessa?
    private readonly string _baseUrl;
    private readonly string _userName;
    private readonly string _password;
    private readonly string _presentableBaseUrl;
    public WebDavService(IConfiguration configuration)
    {
        _baseUrl = configuration["WebDav:BaseUrl"] ?? throw new InvalidOperationException("WebDav:BaseUrl configuration is missing");
        _userName = configuration["WebDav:Username"] ?? throw new InvalidOperationException("WebDav:Username configuration is missing");
        _password = configuration["WebDav:Password"] ?? throw new InvalidOperationException("WebDav:Password configuration is missing");
        _presentableBaseUrl = configuration["PresentableBaseUrl"] ?? throw new InvalidOperationException("PresentableBaseUrl configuration is missing");
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
    // Utseende på uri från imagepicker
    // "file:///data/user/0/host.exp.exponent/cache/ImagePicker/0784f2f8-9b6a-4589-aadf-561bd89873aa.jpeg"

    public async Task<string> UploadFileAsync(Stream stream, string? subDirectory)
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
                throw new Exception($"Failed to upload file. Status code: {result.StatusCode}");
            }

            return $"{remotePath}";
        }
        catch (Exception ex)
        {
            throw new Exception("Error uploading file", ex);
        }
    }

    public async Task<bool> DeleteFileAsync(string relativePath)
    {
        try
        {
            using var client = CreateClient();
            {
                var result = await client.Delete(relativePath); // relativePath ex "reviews/guid.jpeg"
                return result.IsSuccessful;
            }
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
