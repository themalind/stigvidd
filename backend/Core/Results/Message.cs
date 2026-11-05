// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Results;

public class Message
{
    public int StatusCode { get; set; }
    public string? ResultMessage { get; set; }

    // Machine-readable reason the app maps to its own copy, e.g. "event_full". keep-comment: contract with the app, never rename a value
    public string? Code { get; set; }

    // Extra fields for a coded error, sent as ProblemDetails extensions, e.g. the unknown nicknames of an invite. keep-comment: only coded errors carry them
    public IReadOnlyDictionary<string, object>? Details { get; init; }

    public Message(int statusCode, string? resultMessage = default, string? code = default)
    {
        StatusCode = statusCode;
        ResultMessage = resultMessage;
        Code = code;
    }
}
