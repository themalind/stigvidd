namespace Core.Interfaces.Services;

public interface ITrailImportAnalysisService
{
    Task AnalyzeAsync(int sessionId, CancellationToken ctoken);
    Task FailInterruptedSessionsAsync(CancellationToken ctoken);
}
