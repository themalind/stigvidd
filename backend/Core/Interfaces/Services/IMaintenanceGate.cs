// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services;

// Held by an import while the database is replaced; every background worker waits on it before touching a row. keep-comment: contract each worker must honour
public interface IMaintenanceGate
{
    bool IsPaused { get; }

    IDisposable Pause();

    Task WaitWhilePausedAsync(CancellationToken ctoken);
}
