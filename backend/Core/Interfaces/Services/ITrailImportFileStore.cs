using Core.TrailImport.Source;

namespace Core.Interfaces.Services;

// Keeps uploaded source files on disk. They are far too big for a text column and the
// analysis reads them back whenever a session is re-analysed.
public interface ITrailImportFileStore
{
    Task<StoredImportFile> SaveAsync(Stream content, string fileName, CancellationToken ctoken);
    void Delete(string storedPath);
}
