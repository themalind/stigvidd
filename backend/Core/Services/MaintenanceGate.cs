// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;

namespace Core.Services;

public class MaintenanceGate : IMaintenanceGate
{
    private readonly Lock _lock = new();
    private TaskCompletionSource? _paused;

    public bool IsPaused
    {
        get { lock (_lock) return _paused is not null; }
    }

    public IDisposable Pause()
    {
        lock (_lock)
        {
            if (_paused is not null)
                throw new InvalidOperationException("Maintenance is already in progress.");

            _paused = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        }

        return new Resume(this);
    }

    public Task WaitWhilePausedAsync(CancellationToken ctoken)
    {
        Task? paused;
        lock (_lock) paused = _paused?.Task;

        return paused is null ? Task.CompletedTask : paused.WaitAsync(ctoken);
    }

    private void Release()
    {
        TaskCompletionSource? paused;
        lock (_lock)
        {
            paused = _paused;
            _paused = null;
        }

        paused?.TrySetResult();
    }

    private sealed class Resume(MaintenanceGate gate) : IDisposable
    {
        private int _disposed;

        public void Dispose()
        {
            if (Interlocked.Exchange(ref _disposed, 1) == 0)
                gate.Release();
        }
    }
}
