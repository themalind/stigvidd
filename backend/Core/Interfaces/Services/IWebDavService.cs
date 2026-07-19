namespace Core.Interfaces.Services;

public interface IWebDavService
{
    Task<Result<string?>> UploadFileAsync(Stream stream, string? subDirectory, string extension = "jpeg");
    Task<Result<bool>> DeleteFileAsync(string fileUrl);
    Task EnsureDirectoryExistsAsync(string directoryPath);

    // Data transfer (export/import): read a file's bytes by its exact stored
    // path, and write bytes back to an exact path (preserving the original
    // path so DB references stay valid — unlike UploadFileAsync which mints a
    // new GUID name).
    Task<Stream?> DownloadFileAsync(string relativePath);
    Task<Result<bool>> UploadToPathAsync(Stream stream, string exactPath);
}
