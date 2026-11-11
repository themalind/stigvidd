// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Diagnostics.CodeAnalysis;

namespace Core.Results;

public class RepositoryResult<T>
{
    public T? Value { get; }
    public RepositoryResultStatus Status { get; }

    [MemberNotNullWhen(true, nameof(Value))]
    public bool IsSuccess => Status == RepositoryResultStatus.Success;

    private RepositoryResult(T? value, RepositoryResultStatus status)
    {
        Value = value;
        Status = status;
    }

    public static RepositoryResult<T> Success(T value)
    {
        return new(value, RepositoryResultStatus.Success);
    }

    public static RepositoryResult<T> NotFound()
    {
        return new(default, RepositoryResultStatus.NotFound);
    }

    public static RepositoryResult<T> Conflict()
    {
        return new(default, RepositoryResultStatus.Conflict);
    }

    public static RepositoryResult<T> Error()
    {
        return new(default, RepositoryResultStatus.Error);
    }
}
