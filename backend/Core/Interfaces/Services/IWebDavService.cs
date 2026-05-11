namespace Core.Interfaces.Services;

public interface IWebDavService
{
    Task<Result<string?>> UploadFileAsync(Stream stream, string? subDirectory);
    Task<Result<bool>> DeleteFileAsync(string fileUrl);
    Task EnsureDirectoryExistsAsync(string directoryPath);
}
