using Core.Interfaces.Services;
using System.Threading.Channels;

namespace Core.Services;

// Unbounded on purpose: the producer is an admin uploading a file by hand, so the queue
// never grows faster than a person can click.
public class TrailImportAnalysisQueue : ITrailImportAnalysisQueue
{
    private readonly Channel<int> _sessions = Channel.CreateUnbounded<int>(new UnboundedChannelOptions
    {
        SingleReader = true,
    });

    public void Enqueue(int sessionId) => _sessions.Writer.TryWrite(sessionId);

    public IAsyncEnumerable<int> DequeueAllAsync(CancellationToken ctoken) =>
        _sessions.Reader.ReadAllAsync(ctoken);
}
