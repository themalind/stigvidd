// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Microsoft.Extensions.Logging;

namespace UnitTests;

public sealed record LogEntry(
    LogLevel Level,
    string Message,
    IReadOnlyDictionary<string, object?> Values,
    Exception? Exception);
