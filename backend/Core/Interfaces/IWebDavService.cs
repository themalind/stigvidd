namespace Core.Interfaces;

public interface IWebDavService
{
    public Task<Result<string?>> UploadFileAsync(Stream stream, string? subDirectory);
    public Task<Result<bool>> DeleteFileAsync(string fileUrl);
    public Task EnsureDirectoryExistsAsync(string directoryPath);
}
