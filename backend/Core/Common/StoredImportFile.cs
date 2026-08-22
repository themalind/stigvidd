namespace Core.Common;

// An uploaded source file after it has been written to disk. The hash is taken while
// writing, so the file is only read once.
public sealed record StoredImportFile(string StoredPath, string FileHash, long SizeBytes);
