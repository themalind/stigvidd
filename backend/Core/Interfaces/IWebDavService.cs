namespace Core.Interfaces;

public interface IWebDavService
{
    public Task<string> UploadFileAsync(Stream stream, string? subDirectory);
    public Task<bool> DeleteFileAsync(string fileUrl);
    public Task EnsureDirectoryExistsAsync(string directoryPath);
}
