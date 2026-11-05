// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Results;

public class Result<T> : Result
{
    public T? Value { get; set; }

    protected internal Result(T? value, bool success, Message? ResultMessage)
        : base(success, ResultMessage)
    {
        Value = value;
    }
}
