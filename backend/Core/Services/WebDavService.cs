using Core.Interfaces.Services;
using Microsoft.Extensions.Logging;
using System.Net.Sockets;
using WebDav;

namespace Core.Services;

public class WebDavService : IWebDavService
{
    private const int MaxUploadAttempts = 3;
    private const int RetryBaseDelayMs = 300;

    private readonly ILogger<WebDavService> _logger;
    private readonly Func<IWebDavClient> _clientFactory;

    public WebDavService(ILogger<WebDavService> logger, Func<IWebDavClient> clientFactory)
    {
        _logger = logger;
        _clientFactory = clientFactory;
    }

    // https://github.com/skazantsev/WebDavClient/tree/main/src/WebDav.Client/Request

    public async Task<Result<string?>> UploadFileAsync(Stream stream, string? subDirectory, string extension = "jpeg")
    {
        // Creates a safe file name for the uploaded file, preserving the (processed) format's extension.
        var safeExtension = string.IsNullOrWhiteSpace(extension) ? "jpeg" : extension.TrimStart('.');
        var fileName = $"{Guid.NewGuid()}.{safeExtension}";

        var remotePath = subDirectory != null
           ? $"{subDirectory.TrimEnd('/')}/{fileName}"
           : fileName;

        // Buffer the content once so each retry can re-send it from the start
        // (the incoming stream is forward-only and would be drained after attempt 1).
        using var buffer = new MemoryStream();
        await stream.CopyToAsync(buffer);

        Exception? lastError = null;

        for (var attempt = 1; attempt <= MaxUploadAttempts; attempt++)
        {
            buffer.Position = 0;

            try
            {
                using var client = _clientFactory();

                var result = await client.PutFile(remotePath, buffer);

                if (result.IsSuccessful)
                    return Result.Ok<string?>($"{remotePath}");

                // A real HTTP status (e.g. 403/409/500) is not a transient transport error — don't retry.
                _logger.LogError("UploadFileAsync: Could not upload image {remotePath}. Status {Status}", remotePath, result.StatusCode);

                return Result.Fail<string?>(new Message(result.StatusCode, $"UploadFileAsync: Could not upload files. {result.StatusCode}"));
            }
            catch (Exception ex) when (IsTransient(ex))
            {
                lastError = ex;
                _logger.LogWarning(ex, "UploadFileAsync: transient failure uploading {remotePath} (attempt {Attempt}/{Max}).", remotePath, attempt, MaxUploadAttempts);

                if (attempt < MaxUploadAttempts)
                    await Task.Delay(RetryBaseDelayMs * attempt);
            }
        }

        _logger.LogError(lastError, "UploadFileAsync: Could not upload image {remotePath} after {Max} attempts.", remotePath, MaxUploadAttempts);

        throw new Exception("Error uploading file", lastError);
    }

    // Connection-level failures (reset/refused/timeout) are worth retrying; anything else is not.
    private static bool IsTransient(Exception ex) =>
        ex is HttpRequestException or IOException or SocketException
        || ex.InnerException is HttpRequestException or IOException or SocketException;

    public async Task<Result<bool>> DeleteFileAsync(string relativePath)
    {
        try
        {
            using var client = _clientFactory();

            var result = await client.Delete(relativePath); // relativePath ex "reviews/guid.jpeg"

            if (!result.IsSuccessful)
            {
                _logger.LogError("DeleteFileAsync: Could not delete file with path: {relativePath}", relativePath);

                return Result.Fail<bool>(new Message(result.StatusCode, $"DeleteFileAsync: Could not delete file"));
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
        using var client = _clientFactory();

        var result = await client.Mkcol(directoryPath);

        if (!result.IsSuccessful && result.StatusCode != 405) // 405 = already exists
        {
            throw new Exception($"Could not create directory: {result.StatusCode}");
        }
    }

    public async Task<Stream?> DownloadFileAsync(string relativePath)
    {
        var client = _clientFactory();
        var response = await client.GetRawFile(relativePath);

        if (!response.IsSuccessful)
        {
            _logger.LogWarning("DownloadFileAsync: {Path} -> {Status}", relativePath, response.StatusCode);
            return null;
        }

        return response.Stream;
    }

    public async Task<Result<bool>> UploadToPathAsync(Stream stream, string exactPath)
    {
        var client = _clientFactory();

        // Buffer so nginx (create_full_put_path) gets a length-known body and a
        // rewindable source.
        using var buffer = new MemoryStream();
        await stream.CopyToAsync(buffer);
        buffer.Position = 0;

        var result = await client.PutFile(exactPath, buffer);

        return result.IsSuccessful
            ? Result.Ok(true)
            : Result.Fail<bool>(new Message(result.StatusCode, $"UploadToPathAsync: could not write {exactPath}"));
    }
}
