// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;

namespace Core.Repositories;

// keep-comment: the tests run this on SQLite only; check a change against PostgreSQL (docs/notes/raw-sql-needs-a-postgres-check-the-sqlite-tests-cannot-give.md)
internal static class HikeShareInsert
{
    /// <summary>Returns how many rows were actually inserted.</summary>
    public static async Task<int> InsertSkippingExistingAsync(StigViddDbContext context, IReadOnlyCollection<HikeShare> hikeShares, CancellationToken ctoken)
    {
        if (hikeShares.Count == 0)
            return 0;

        var sqlHelper = context.GetService<ISqlGenerationHelper>();
        var table = sqlHelper.DelimitIdentifier("HikeShares", context.Model.GetDefaultSchema());
        var columns = string.Join(", ", new[]
        {
            nameof(HikeShare.HikeId), nameof(HikeShare.SharedWithId), nameof(HikeShare.SharedById),
            nameof(HikeShare.CreatedAt), nameof(HikeShare.Status), nameof(HikeShare.AllowResharing),
        }.Select(c => sqlHelper.DelimitIdentifier(c)));

        var parameters = new List<object>();
        string Param(object? value)
        {
            // keep-comment: EF has no store type for a raw DBNull parameter, so null goes in as a literal
            if (value is null)
                return "NULL";
            parameters.Add(value);
            return "{" + (parameters.Count - 1) + "}";
        }

        var rows = hikeShares.Select(hs => "(" + string.Join(", ",
            Param(hs.HikeId), Param(hs.SharedWithId), Param(hs.SharedById),
            Param(hs.CreatedAt), Param((int)hs.Status), Param(hs.AllowResharing)) + ")").ToList();

        // keep-comment: a concurrent share may already have inserted a recipient; that row wins instead of failing the batch
        var sql = "INSERT INTO " + table + " (" + columns + ") VALUES " + string.Join(", ", rows) + " ON CONFLICT DO NOTHING";
        return await context.Database.ExecuteSqlRawAsync(sql, parameters, ctoken);
    }
}
