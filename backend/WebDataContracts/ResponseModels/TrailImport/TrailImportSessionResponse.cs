namespace WebDataContracts.ResponseModels.TrailImport;

// An uploaded file and how far it has got. Counts are only filled in once the analysis
// has run, so a session still being analysed reports nulls rather than zeroes.
public class TrailImportSessionResponse
{
    public required int Id { get; set; }
    public required string Identifier { get; set; }
    public required string Source { get; set; }
    public required string FileName { get; set; }
    public required string FileHash { get; set; }
    public long FileSizeBytes { get; set; }
    public required string Status { get; set; }
    public string? UploadedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? AnalyzedAt { get; set; }
    public DateTime? AppliedAt { get; set; }
    public int FeatureCount { get; set; }
    public string? ErrorMessage { get; set; }
    public TrailImportCountsResponse? Counts { get; set; }

    // Earlier sessions built from a byte-identical file. Empty is the normal case.
    public IReadOnlyCollection<string>? DuplicateOf { get; set; }
}
