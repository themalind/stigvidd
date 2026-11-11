// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Results;

public class RepositoryResult
{
    public RepositoryResultStatus Status { get; }
    public bool IsSuccess => Status == RepositoryResultStatus.Success;

    private RepositoryResult(RepositoryResultStatus status)
    {
        Status = status;
    }

    public static RepositoryResult Success()
    {
        return new(RepositoryResultStatus.Success);
    }

    public static RepositoryResult NotFound()
    {
        return new(RepositoryResultStatus.NotFound);
    }

    public static RepositoryResult Conflict()
    {
        return new(RepositoryResultStatus.Conflict);
    }

    public static RepositoryResult Error()
    {
        return new(RepositoryResultStatus.Error);
    }
}
