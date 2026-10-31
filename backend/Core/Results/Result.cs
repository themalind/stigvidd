// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Results;

public class Result
{
    public bool Success { get; }
    public Message? Message { get; private set; }
    public bool IsFailure => !Success;

    protected Result(bool success, Message? message)
    {
        Success = success;
        Message = message;
    }

    public static Result Fail(Message message)
    {
        return new Result(false, message);
    }

    public static Result<T> Fail<T>(Message message)
    {
        return new Result<T>(default, false, message);
    }
    public static Result Ok()
    {
        return new Result(true, null);
    }

    public static Result<T> Ok<T>(T value)
    {
        return new Result<T>(value, true, null);
    }
}

public class Result<T> : Result
{
    public T? Value { get; set; }

    protected internal Result(T? value, bool success, Message? ResultMessage)
        : base(success, ResultMessage)
    {
        Value = value;
    }
}

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

// https://achraf-chennan.medium.com/using-the-result-class-in-c-519da90351f0