// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Microsoft.Extensions.Logging;

namespace UnitTests;

public sealed record LogEntry(
    LogLevel Level,
    string Message,
    IReadOnlyDictionary<string, object?> Values,
    Exception? Exception);

public sealed class RecordingLogger<T> : ILogger<T>
{
    public List<LogEntry> Entries { get; } = [];

    public List<IReadOnlyDictionary<string, object?>> Scopes { get; } = [];

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull
    {
        Scopes.Add(ToDictionary(state));
        return null;
    }

    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter)
    {
        Entries.Add(new LogEntry(logLevel, formatter(state, exception), ToDictionary(state), exception));
    }

    private static IReadOnlyDictionary<string, object?> ToDictionary<TState>(TState state) =>
        state is IEnumerable<KeyValuePair<string, object?>> pairs
            ? pairs.GroupBy(pair => pair.Key).ToDictionary(group => group.Key, group => group.Last().Value)
            : new Dictionary<string, object?>();
}
