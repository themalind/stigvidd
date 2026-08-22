namespace WebDataContracts.ResponseModels.TrailImport;

// The summary row above the review list, and what tells the reviewer whether anything is
// left to do.
public class TrailImportCountsResponse
{
    public int Total { get; set; }
    public int Certain { get; set; }
    public int High { get; set; }
    public int Medium { get; set; }
    public int Unmatched { get; set; }
    public int Pending { get; set; }
    public int Accepted { get; set; }
    public int Relinked { get; set; }
    public int CreateNew { get; set; }
    public int Excluded { get; set; }
    public int Skipped { get; set; }
}
