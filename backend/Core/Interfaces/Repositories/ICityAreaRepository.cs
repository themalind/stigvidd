// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Linq.Expressions;
using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories;

public interface ICityAreaRepository
{
    Task<RepositoryResult<IReadOnlyCollection<T>>> GetAllAsync<T>(Expression<Func<CityArea, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<T>> GetByIdentifierAsync<T>(string identifier, Expression<Func<CityArea, T>> selector, CancellationToken ctoken);
}
