// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Results;

public class Message
{
    public int StatusCode { get; set; }
    public string? ResultMessage { get; set; }

    public Message(int statusCode, string? resultMessage = default)
    {
        StatusCode = statusCode;
        ResultMessage = resultMessage;
    }
}
