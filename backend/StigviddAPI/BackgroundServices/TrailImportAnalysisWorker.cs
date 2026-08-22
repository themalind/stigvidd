using Core.Interfaces.Services;

namespace StigviddAPI.BackgroundServices;

// Runs the analysis of uploaded source files, one session at a time, off the request path.
public class TrailImportAnalysisWorker : BackgroundService
{
    private readonly ITrailImportAnalysisQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<TrailImportAnalysisWorker> _logger;

    public TrailImportAnalysisWorker(
        ITrailImportAnalysisQueue queue,
        IServiceScopeFactory scopeFactory,
        ILogger<TrailImportAnalysisWorker> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // A session left Analyzing by a restart has no worker holding it: the queue lives
        // in memory. Marking it lets the review view stop waiting. Assumes one API instance.
        using (var startup = _scopeFactory.CreateScope())
        {
            var interrupted = startup.ServiceProvider.GetRequiredService<ITrailImportAnalysisService>();
            await interrupted.FailInterruptedSessionsAsync(stoppingToken);
        }

        await foreach (var sessionId in _queue.DequeueAllAsync(stoppingToken))
        {
            try
            {
                // A hosted service is a singleton, so the service is resolved per session.
                using var scope = _scopeFactory.CreateScope();
                var analysis = scope.ServiceProvider.GetRequiredService<ITrailImportAnalysisService>();

                await analysis.AnalyzeAsync(sessionId, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Shutting down
                return;
            }
            catch (Exception ex)
            {
                // Swallowed so one bad file does not stop the worker for every later upload.
                _logger.LogError(ex, "TrailImportAnalysisWorker: Session {sessionId} could not be analysed.", sessionId);
            }
        }
    }
}
